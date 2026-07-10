-- Task 174: safe bot credential lifecycle and backend-only rate-limit foundation.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.can_manage_community_bots(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_community_owner(target_community_id) or exists (
    select 1 from public.community_members membership
    join public.roles role on role.id = membership.role_id and role.community_id = membership.community_id
    where membership.community_id = target_community_id and membership.user_id = auth.uid()
      and (role.level >= 80 or coalesce((role.permissions ->> 'manageCommunity')::boolean, false))
  );
$$;
revoke all on function public.can_manage_community_bots(uuid) from public, anon;
grant execute on function public.can_manage_community_bots(uuid) to authenticated;

create table if not exists public.bot_action_rate_limits (
  credential_id uuid not null references public.bot_credentials(id) on delete cascade,
  action_key text not null check (action_key in ('api_request','message_send','reaction_write','event_delivery','command_invoke')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  denied_count integer not null default 0 check (denied_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (credential_id, action_key)
);
alter table public.bot_action_rate_limits enable row level security;
revoke all on public.bot_action_rate_limits from anon, authenticated;
comment on table public.bot_action_rate_limits is 'Backend-only bot counters; never store tokens, authorization headers, commands, message content, IP addresses, or private metadata.';

create or replace function public.issue_community_bot_credential(target_community_id uuid, target_bot_id uuid)
returns table(raw_token text, token_prefix text, created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  secret_bytes bytea;
  issued_raw_token text;
  issued_prefix text;
  issued_created_at timestamptz := now();
begin
  if auth.uid() is null or not public.can_manage_community_bots(target_community_id) then raise exception 'BOT_MANAGER_REQUIRED'; end if;
  if not exists (
    select 1 from public.community_bots installation
    join public.bots bot on bot.id = installation.bot_id
    join public.roles role on role.id = installation.role_id and role.community_id = installation.community_id
    where installation.community_id = target_community_id and installation.bot_id = target_bot_id
      and (bot.owner_id = auth.uid() or public.is_app_admin())
  ) then raise exception 'BOT_INSTALLATION_NOT_OWNED'; end if;
  if exists (select 1 from public.bot_credentials credential where credential.bot_id = target_bot_id and credential.revoked_at is null) then raise exception 'BOT_CREDENTIAL_EXISTS'; end if;

  secret_bytes := extensions.gen_random_bytes(32);
  issued_prefix := substr(encode(secret_bytes, 'hex'), 1, 12);
  issued_raw_token := 'picom_bot_' || issued_prefix || '_' || rtrim(translate(encode(secret_bytes, 'base64'), '+/', '-_'), '=');
  insert into public.bot_credentials(bot_id, token_prefix, token_hash, created_by, created_at)
  values(target_bot_id, issued_prefix, encode(extensions.digest(convert_to(issued_raw_token, 'UTF8'), 'sha256'), 'hex'), auth.uid(), issued_created_at);

  perform public.append_community_audit_log(target_community_id, 'moderation_action', 'bot_credential', target_bot_id, 'Bot credential issued');
  return query select issued_raw_token, issued_prefix, issued_created_at;
end;
$$;
revoke all on function public.issue_community_bot_credential(uuid,uuid) from public, anon;
grant execute on function public.issue_community_bot_credential(uuid,uuid) to authenticated;

create or replace function public.revoke_community_bot_credential(target_community_id uuid, target_bot_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare affected integer;
begin
  if auth.uid() is null or not public.can_manage_community_bots(target_community_id) then raise exception 'BOT_MANAGER_REQUIRED'; end if;
  if not exists (select 1 from public.community_bots installation join public.bots bot on bot.id = installation.bot_id where installation.community_id = target_community_id and installation.bot_id = target_bot_id and (bot.owner_id = auth.uid() or public.is_app_admin())) then raise exception 'BOT_INSTALLATION_NOT_OWNED'; end if;
  update public.bot_credentials set revoked_at = now() where bot_id = target_bot_id and revoked_at is null;
  get diagnostics affected = row_count;
  if affected > 0 then perform public.append_community_audit_log(target_community_id, 'moderation_action', 'bot_credential', target_bot_id, 'Bot credential revoked'); end if;
  return affected > 0;
end;
$$;
revoke all on function public.revoke_community_bot_credential(uuid,uuid) from public, anon;
grant execute on function public.revoke_community_bot_credential(uuid,uuid) to authenticated;

create or replace function public.get_community_bot_credential_status(target_community_id uuid, target_bot_id uuid)
returns table(bot_id uuid, token_prefix text, created_at timestamptz, revoked_at timestamptz, rate_limit_per_minute integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_manage_community_bots(target_community_id) then raise exception 'BOT_MANAGER_REQUIRED'; end if;
  return query select target_bot_id, credential.token_prefix, credential.created_at, credential.revoked_at, 60 from public.bot_credentials credential where credential.bot_id = target_bot_id order by credential.created_at desc limit 1;
end;
$$;
revoke all on function public.get_community_bot_credential_status(uuid,uuid) from public, anon;
grant execute on function public.get_community_bot_credential_status(uuid,uuid) to authenticated;

create or replace function public.consume_bot_action_rate_limit(target_credential_id uuid, target_action text, target_limit integer default 60, target_window_seconds integer default 60)
returns table(is_allowed boolean, retry_after_seconds integer)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare current_time timestamptz := now(); current_count integer; window_start timestamptz;
begin
  if current_user not in ('service_role','postgres','supabase_admin') then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if target_limit < 1 or target_limit > 1000 or target_window_seconds < 1 or target_window_seconds > 3600 then raise exception 'INVALID_RATE_LIMIT'; end if;
  if not exists (select 1 from public.bot_credentials credential where credential.id = target_credential_id and credential.revoked_at is null) then raise exception 'BOT_CREDENTIAL_INVALID'; end if;
  insert into public.bot_action_rate_limits(credential_id,action_key,window_started_at,request_count,updated_at) values(target_credential_id,target_action,current_time,1,current_time)
  on conflict (credential_id,action_key) do update set window_started_at = case when bot_action_rate_limits.window_started_at <= current_time - make_interval(secs => target_window_seconds) then current_time else bot_action_rate_limits.window_started_at end, request_count = case when bot_action_rate_limits.window_started_at <= current_time - make_interval(secs => target_window_seconds) then 1 else bot_action_rate_limits.request_count + 1 end, updated_at = current_time
  returning request_count, window_started_at into current_count, window_start;
  if current_count > target_limit then update public.bot_action_rate_limits set denied_count = denied_count + 1 where credential_id = target_credential_id and action_key = target_action; end if;
  return query select current_count <= target_limit, case when current_count <= target_limit then 0 else greatest(1, ceil(extract(epoch from (window_start + make_interval(secs => target_window_seconds) - current_time)))::integer) end;
end;
$$;
revoke all on function public.consume_bot_action_rate_limit(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_bot_action_rate_limit(uuid,text,integer,integer) to service_role;

comment on function public.issue_community_bot_credential(uuid,uuid) is 'Returns a high-entropy raw token once to the authorized bot owner/app admin; only SHA-256 hash and non-secret prefix are stored.';
comment on function public.consume_bot_action_rate_limit(uuid,text,integer,integer) is 'Backend-only atomic bot rate limit. Public bot API remains disabled.';
