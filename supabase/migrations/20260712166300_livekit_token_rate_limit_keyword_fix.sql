-- Replace the hosted limiter after the historical current_time variable was
-- parsed as PostgreSQL CURRENT_TIME (timetz) instead of the intended timestamp.
begin;

create or replace function public.consume_current_user_action_rate_limit(target_action text)
returns table(is_allowed boolean,retry_after_seconds integer)
language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare
  current_user_id uuid:=auth.uid();
  configured_maximum_requests integer;
  configured_window_seconds integer;
  current_row public.user_action_rate_limits%rowtype;
  observed_at timestamptz:=clock_timestamp();
begin
  if current_user_id is null then return query select false,60; return; end if;
  select configured.maximum_requests,configured.window_seconds
  into configured_maximum_requests,configured_window_seconds
  from(values
    ('message_send',30,60),('attachment_metadata',20,300),('reaction_write',120,60),('relationship_write',30,60),('feed_interaction',120,60),
    ('livekit_token',10,60),('meeting_schedule_write',20,300),('meeting_invite_write',30,300),('meeting_join_preview',30,60),
    ('meeting_signal_write',12,60),('meeting_waiting_request',6,300),('meeting_chat_send',20,30),('meeting_reaction',8,3),('meeting_privileged_action',30,60)
  ) configured(action_key,maximum_requests,window_seconds)
  where configured.action_key=target_action;
  if configured_maximum_requests is null then raise exception 'RATE_LIMIT_ACTION_INVALID'; end if;
  insert into public.user_action_rate_limits(user_id,action_key,window_started_at,request_count,updated_at)
  values(current_user_id,target_action,observed_at,1,observed_at)
  on conflict(user_id,action_key) do update set
    window_started_at=case when user_action_rate_limits.window_started_at<=observed_at-make_interval(secs=>configured_window_seconds) then observed_at else user_action_rate_limits.window_started_at end,
    request_count=case when user_action_rate_limits.window_started_at<=observed_at-make_interval(secs=>configured_window_seconds) then 1 else user_action_rate_limits.request_count+1 end,
    updated_at=observed_at returning * into current_row;
  if current_row.request_count>configured_maximum_requests then
    update public.user_action_rate_limits set denied_count=denied_count+1,last_denied_at=observed_at,updated_at=observed_at where user_id=current_user_id and action_key=target_action;
  end if;
  return query select current_row.request_count<=configured_maximum_requests,
    case when current_row.request_count<=configured_maximum_requests then 0 else greatest(1,ceil(extract(epoch from(current_row.window_started_at+make_interval(secs=>configured_window_seconds)-observed_at)))::integer) end;
end;
$$;

revoke all on function public.consume_current_user_action_rate_limit(text) from public,anon;
grant execute on function public.consume_current_user_action_rate_limit(text) to authenticated;
comment on function public.consume_current_user_action_rate_limit(text) is 'Canonical content-free per-user action limiter using an unambiguous timestamptz observation point.';

commit;
