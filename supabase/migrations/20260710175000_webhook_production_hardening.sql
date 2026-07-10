-- Task 176: trusted webhook create/revoke and removal of renderer credential mutations.

alter table public.webhooks drop constraint if exists webhooks_avatar_url_safe;
alter table public.webhooks add constraint webhooks_avatar_url_safe check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://'));

revoke insert, update, delete on public.webhooks from authenticated;
drop policy if exists "webhooks_manager_insert" on public.webhooks;
drop policy if exists "webhooks_manager_revoke" on public.webhooks;

create or replace function public.create_channel_webhook(target_community_id uuid, target_channel_id uuid, target_webhook_name text, webhook_avatar_url text default null)
returns table(webhook_id uuid, community_id uuid, channel_id uuid, webhook_name text, avatar_url text, created_by uuid, revoked_at timestamptz, created_at timestamptz, updated_at timestamptz, token_once text)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare secret_bytes bytea; issued_token text; issued_hash text; new_hook public.webhooks%rowtype; normalized_name text := btrim(target_webhook_name); normalized_avatar text := nullif(btrim(webhook_avatar_url), '');
begin
  if auth.uid() is null or not public.can_manage_channel_webhooks(target_community_id) then raise exception 'WEBHOOK_MANAGER_REQUIRED'; end if;
  if char_length(normalized_name) < 1 or char_length(normalized_name) > 80 then raise exception 'WEBHOOK_VALIDATION_ERROR'; end if;
  if normalized_avatar is not null and (char_length(normalized_avatar) > 2048 or normalized_avatar !~ '^https://') then raise exception 'WEBHOOK_VALIDATION_ERROR'; end if;
  if not exists (select 1 from public.channels channel where channel.id = target_channel_id and channel.community_id = target_community_id and channel.type = 'text') then raise exception 'WEBHOOK_CHANNEL_FORBIDDEN'; end if;
  secret_bytes := extensions.gen_random_bytes(32); issued_token := encode(secret_bytes, 'hex'); issued_hash := encode(extensions.digest(convert_to(issued_token, 'UTF8'), 'sha256'), 'hex');
  insert into public.webhooks(community_id,channel_id,name,avatar_url,token_hash,created_by) values(target_community_id,target_channel_id,normalized_name,normalized_avatar,issued_hash,auth.uid()) returning * into new_hook;
  perform public.append_community_audit_log(target_community_id, 'webhook_create', 'webhook', new_hook.id, 'Webhook created');
  return query select new_hook.id,new_hook.community_id,new_hook.channel_id,new_hook.name,new_hook.avatar_url,new_hook.created_by,new_hook.revoked_at,new_hook.created_at,new_hook.updated_at,issued_token;
end;
$$;
revoke all on function public.create_channel_webhook(uuid,uuid,text,text) from public, anon;
grant execute on function public.create_channel_webhook(uuid,uuid,text,text) to authenticated;

create or replace function public.revoke_channel_webhook(target_webhook_id uuid)
returns table(webhook_id uuid, community_id uuid, channel_id uuid, webhook_name text, avatar_url text, created_by uuid, revoked_at timestamptz, created_at timestamptz, updated_at timestamptz)
language plpgsql volatile security definer set search_path = public as $$
declare hook public.webhooks%rowtype;
begin
  select * into hook from public.webhooks item where item.id = target_webhook_id for update;
  if not found or auth.uid() is null or not public.can_manage_channel_webhooks(hook.community_id) then raise exception 'WEBHOOK_INVALID'; end if;
  if hook.revoked_at is null then update public.webhooks set revoked_at=now(),updated_at=now() where id=hook.id returning * into hook; perform public.append_community_audit_log(hook.community_id,'webhook_revoke','webhook',hook.id,'Webhook revoked'); end if;
  return query select hook.id,hook.community_id,hook.channel_id,hook.name,hook.avatar_url,hook.created_by,hook.revoked_at,hook.created_at,hook.updated_at;
end;
$$;
revoke all on function public.revoke_channel_webhook(uuid) from public, anon;
grant execute on function public.revoke_channel_webhook(uuid) to authenticated;

comment on function public.create_channel_webhook(uuid,uuid,text,text) is 'Manager-only trusted token generation. Raw token is returned once and only its SHA-256 hash is stored.';
comment on function public.revoke_channel_webhook(uuid) is 'Manager-only idempotent webhook revocation with append-only audit.';
