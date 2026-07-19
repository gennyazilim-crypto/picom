-- Task 125: fixed server-side user action limits.
-- Counters never store IP addresses, credentials, headers, or user content.

create table if not exists public.user_action_rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_key text not null check (action_key in ('message_send','attachment_metadata','reaction_write','relationship_write','feed_interaction','livekit_token')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  denied_count integer not null default 0 check (denied_count >= 0),
  last_denied_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, action_key)
);
alter table public.user_action_rate_limits enable row level security;
revoke all on table public.user_action_rate_limits from anon, authenticated;
comment on table public.user_action_rate_limits is 'Backend-enforced user/action counters. Never store secrets, raw IP addresses, authorization headers, or user content.';
create or replace function public.consume_current_user_action_rate_limit(target_action text)
returns table(is_allowed boolean, retry_after_seconds integer)
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  configured_maximum_requests integer;
  configured_window_seconds integer;
  current_row public.user_action_rate_limits%rowtype;
  current_time timestamptz := clock_timestamp();
begin
  if current_user_id is null then
    return query select false, 60;
    return;
  end if;

  select configured.maximum_requests, configured.window_seconds
  into configured_maximum_requests, configured_window_seconds
  from (values
    ('message_send', 30, 60),
    ('attachment_metadata', 20, 300),
    ('reaction_write', 120, 60),
    ('relationship_write', 30, 60),
    ('feed_interaction', 120, 60),
    ('livekit_token', 10, 60)
  ) as configured(action_key, maximum_requests, window_seconds)
  where configured.action_key = target_action;

  if configured_maximum_requests is null then raise exception 'RATE_LIMIT_ACTION_INVALID'; end if;

  insert into public.user_action_rate_limits(user_id,action_key,window_started_at,request_count,updated_at)
  values(current_user_id,target_action,current_time,1,current_time)
  on conflict(user_id,action_key) do update set
    window_started_at = case when user_action_rate_limits.window_started_at <= current_time - make_interval(secs => configured_window_seconds) then current_time else user_action_rate_limits.window_started_at end,
    request_count = case when user_action_rate_limits.window_started_at <= current_time - make_interval(secs => configured_window_seconds) then 1 else user_action_rate_limits.request_count + 1 end,
    updated_at = current_time
  returning * into current_row;

  if current_row.request_count > configured_maximum_requests then
    update public.user_action_rate_limits set denied_count=denied_count+1,last_denied_at=current_time,updated_at=current_time
    where user_id=current_user_id and action_key=target_action;
  end if;

  return query select current_row.request_count <= configured_maximum_requests,
    case when current_row.request_count <= configured_maximum_requests then 0 else greatest(1,ceil(extract(epoch from (current_row.window_started_at + make_interval(secs => configured_window_seconds) - current_time)))::integer) end;
end;
$$;
revoke all on function public.consume_current_user_action_rate_limit(text) from public, anon;
grant execute on function public.consume_current_user_action_rate_limit(text) to authenticated;
create or replace function public.enforce_current_user_action_rate_limit()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare result_row record;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select * into result_row from public.consume_current_user_action_rate_limit(tg_argv[0]);
  if not coalesce(result_row.is_allowed,false) then
    raise exception 'RATE_LIMITED' using errcode='P0001',detail='retry_after_seconds='||coalesce(result_row.retry_after_seconds,60)::text;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.enforce_current_user_action_rate_limit() from public, anon, authenticated;
drop trigger if exists messages_user_rate_limit on public.messages;
create trigger messages_user_rate_limit before insert on public.messages for each row execute function public.enforce_current_user_action_rate_limit('message_send');
drop trigger if exists attachments_user_rate_limit on public.attachments;
create trigger attachments_user_rate_limit before insert on public.attachments for each row execute function public.enforce_current_user_action_rate_limit('attachment_metadata');
drop trigger if exists message_reactions_user_rate_limit on public.message_reactions;
create trigger message_reactions_user_rate_limit before insert or delete on public.message_reactions for each row execute function public.enforce_current_user_action_rate_limit('reaction_write');
drop trigger if exists user_follows_user_rate_limit on public.user_follows;
create trigger user_follows_user_rate_limit before insert or delete on public.user_follows for each row execute function public.enforce_current_user_action_rate_limit('relationship_write');
drop trigger if exists friend_requests_user_rate_limit on public.friend_requests;
create trigger friend_requests_user_rate_limit before insert or update or delete on public.friend_requests for each row execute function public.enforce_current_user_action_rate_limit('relationship_write');
drop trigger if exists saved_messages_user_rate_limit on public.saved_messages;
create trigger saved_messages_user_rate_limit before insert or delete on public.saved_messages for each row execute function public.enforce_current_user_action_rate_limit('feed_interaction');
