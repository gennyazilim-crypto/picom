alter table public.messages
  add column if not exists webhook_id uuid references public.webhooks(id) on delete set null,
  add column if not exists webhook_name text check (webhook_name is null or char_length(webhook_name) between 1 and 80);
create index if not exists idx_messages_webhook_created
  on public.messages (webhook_id, created_at desc)
  where webhook_id is not null;
drop policy if exists "messages_insert_author_visible_text_channel" on public.messages;
create policy "messages_insert_author_visible_text_channel"
on public.messages for insert to authenticated
with check (
  author_id = auth.uid()
  and webhook_id is null
  and webhook_name is null
  and public.can_send_message_to_channel(channel_id)
);
drop policy if exists "messages_update_own_visible_message" on public.messages;
create policy "messages_update_own_visible_message"
on public.messages for update to authenticated
using (
  author_id = auth.uid()
  and webhook_id is null
  and public.can_view_channel(channel_id)
)
with check (
  author_id = auth.uid()
  and webhook_id is null
  and webhook_name is null
  and public.can_view_channel(channel_id)
);
create table if not exists public.webhook_rate_limits (
  webhook_id uuid primary key references public.webhooks(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.webhook_rate_limits enable row level security;
revoke all on table public.webhook_rate_limits from anon, authenticated;
create or replace function public.consume_webhook_rate_limit(
  target_webhook_id uuid,
  maximum_requests integer default 30,
  window_seconds integer default 60
)
returns table(is_allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.webhook_rate_limits%rowtype;
  current_time timestamptz := now();
  window_interval interval;
begin
  if maximum_requests < 1 or maximum_requests > 1000 or window_seconds < 1 or window_seconds > 3600 then
    raise exception 'WEBHOOK_RATE_LIMIT_CONFIG_INVALID';
  end if;

  window_interval := make_interval(secs => window_seconds);
  insert into public.webhook_rate_limits(webhook_id, window_started_at, request_count, updated_at)
  values(target_webhook_id, current_time, 0, current_time)
  on conflict (webhook_id) do nothing;

  select * into current_row
  from public.webhook_rate_limits
  where webhook_id = target_webhook_id
  for update;

  if current_row.window_started_at + window_interval <= current_time then
    update public.webhook_rate_limits
    set window_started_at = current_time, request_count = 1, updated_at = current_time
    where webhook_id = target_webhook_id;
    return query select true, 0;
    return;
  end if;

  if current_row.request_count >= maximum_requests then
    return query select false, greatest(1, ceil(extract(epoch from ((current_row.window_started_at + window_interval) - current_time)))::integer);
    return;
  end if;

  update public.webhook_rate_limits
  set request_count = request_count + 1, updated_at = current_time
  where webhook_id = target_webhook_id;
  return query select true, 0;
end;
$$;
revoke all on function public.consume_webhook_rate_limit(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_webhook_rate_limit(uuid,integer,integer) to service_role;
alter table public.audit_log drop constraint if exists audit_log_action_type_check;
alter table public.audit_log add constraint audit_log_action_type_check check (
  action_type in (
    'community_update','channel_create','channel_update','channel_delete','role_change','member_change',
    'moderation_action','invite_create','invite_revoke','webhook_create','webhook_revoke','webhook_message'
  )
);
create or replace function public.deliver_webhook_message(
  target_webhook_id uuid,
  presented_token_hash text,
  message_body text,
  request_key text default null
)
returns table(message_id uuid, target_community_id uuid, target_channel_id uuid, message_webhook_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hook public.webhooks%rowtype;
  target_channel public.channels%rowtype;
  owner_id uuid;
  manager_allowed boolean := false;
  limit_result record;
  generated_client_id text;
  existing_message_id uuid;
  new_message_id uuid;
begin
  if message_body is null or char_length(btrim(message_body)) < 1 or char_length(btrim(message_body)) > 2000 then
    raise exception 'WEBHOOK_VALIDATION_ERROR';
  end if;
  if presented_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'WEBHOOK_INVALID';
  end if;
  if request_key is not null and request_key !~ '^[A-Za-z0-9._:-]{8,80}$' then
    raise exception 'WEBHOOK_IDEMPOTENCY_INVALID';
  end if;

  select * into hook
  from public.webhooks item
  where item.id = target_webhook_id
    and item.token_hash = presented_token_hash
    and item.revoked_at is null;
  if not found then raise exception 'WEBHOOK_INVALID'; end if;

  select * into target_channel
  from public.channels channel
  where channel.id = hook.channel_id
    and channel.community_id = hook.community_id
    and channel.type = 'text';
  if not found then raise exception 'WEBHOOK_CHANNEL_FORBIDDEN'; end if;

  select community.owner_id into owner_id from public.communities community where community.id = hook.community_id;
  manager_allowed := owner_id = hook.created_by or exists (
    select 1
    from public.community_members membership
    join public.roles role on role.id = membership.role_id
    where membership.community_id = hook.community_id
      and membership.user_id = hook.created_by
      and (role.level >= 80 or coalesce((role.permissions ->> 'manageChannels')::boolean, false))
  );
  if not manager_allowed then raise exception 'WEBHOOK_CHANNEL_FORBIDDEN'; end if;

  if request_key is not null then
    generated_client_id := left('webhook:' || hook.id::text || ':' || request_key, 120);
    select message.id into existing_message_id
    from public.messages message
    where message.webhook_id = hook.id and message.client_message_id = generated_client_id
    limit 1;
    if existing_message_id is not null then
      return query select existing_message_id, hook.community_id, hook.channel_id, hook.name;
      return;
    end if;
  else
    generated_client_id := left('webhook:' || hook.id::text || ':' || gen_random_uuid()::text, 120);
  end if;

  select * into limit_result
  from public.consume_webhook_rate_limit(hook.id, 30, 60);
  if not limit_result.is_allowed then raise exception 'WEBHOOK_RATE_LIMITED'; end if;

  insert into public.messages(community_id, channel_id, author_id, body, client_message_id, webhook_id, webhook_name)
  values(hook.community_id, hook.channel_id, hook.created_by, btrim(message_body), generated_client_id, hook.id, hook.name)
  returning id into new_message_id;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(hook.community_id, hook.created_by, 'webhook_message', 'message', new_message_id, 'Webhook message delivered');

  return query select new_message_id, hook.community_id, hook.channel_id, hook.name;
end;
$$;
revoke all on function public.deliver_webhook_message(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.deliver_webhook_message(uuid,text,text,text) to service_role;
comment on function public.deliver_webhook_message(uuid,text,text,text) is
  'Backend-only atomic webhook token validation, permission check, rate limit, message insert, and audit event.';
