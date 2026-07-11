begin;

create or replace function public.assign_radio_session_host(
  target_session_id uuid,
  target_user_id uuid,
  target_host_role text default 'co_host'
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare target_session public.radio_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_host_role not in ('host', 'co_host', 'producer') then raise exception 'RADIO_HOST_ROLE_INVALID' using errcode = '22023'; end if;
  select * into target_session from public.radio_sessions session where session.id = target_session_id for update;
  if target_session.id is null then raise exception 'RADIO_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.can_manage_radio_session(target_session_id) then raise exception 'RADIO_SESSION_MANAGE_DENIED' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.community_members member
    where member.community_id = target_session.community_id and member.user_id = target_user_id
  ) then raise exception 'RADIO_HOST_MUST_BE_MEMBER' using errcode = '23503'; end if;

  insert into public.radio_session_hosts(radio_session_id, user_id, host_role, assigned_by)
  values(target_session_id, target_user_id, target_host_role, auth.uid())
  on conflict(radio_session_id, user_id)
  do update set host_role = excluded.host_role, assigned_by = excluded.assigned_by, assigned_at = now();

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_session.community_id, auth.uid(), 'community_update', 'radio_host_assignment', target_user_id, 'Radio session host assignment updated to ' || target_host_role);
  return true;
end;
$$;

create or replace function public.transition_radio_session(
  target_session_id uuid,
  next_status text,
  confirmation_session_title text default null
)
returns setof public.radio_sessions language plpgsql security definer set search_path = public, pg_temp as $$
declare target_session public.radio_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if next_status not in ('live', 'ended', 'cancelled') then raise exception 'RADIO_STATUS_INVALID' using errcode = '22023'; end if;
  select * into target_session from public.radio_sessions session where session.id = target_session_id for update;
  if target_session.id is null then raise exception 'RADIO_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.can_manage_radio_session(target_session_id) then raise exception 'RADIO_SESSION_MANAGE_DENIED' using errcode = '42501'; end if;
  if target_session.status in ('ended', 'cancelled') then raise exception 'RADIO_STATUS_TERMINAL' using errcode = '55000'; end if;
  if next_status in ('ended', 'cancelled') and btrim(coalesce(confirmation_session_title, '')) <> target_session.title then
    raise exception 'RADIO_TRANSITION_CONFIRMATION_MISMATCH' using errcode = '22023';
  end if;
  if next_status = 'live' and target_session.status not in ('draft', 'scheduled') then raise exception 'RADIO_START_STATE_INVALID' using errcode = '55000'; end if;
  if next_status = 'ended' and target_session.status <> 'live' then raise exception 'RADIO_END_STATE_INVALID' using errcode = '55000'; end if;
  if next_status = 'cancelled' and target_session.status not in ('draft', 'scheduled') then raise exception 'RADIO_CANCEL_STATE_INVALID' using errcode = '55000'; end if;

  update public.radio_sessions session
  set status = next_status,
      actual_started_at = case when next_status = 'live' then coalesce(session.actual_started_at, now()) else session.actual_started_at end,
      ended_at = case when next_status in ('ended', 'cancelled') then now() else null end,
      updated_at = now()
  where session.id = target_session_id;
  return query select * from public.radio_sessions session where session.id = target_session_id;
end;
$$;

create or replace function public.moderate_radio_listener(
  target_session_id uuid,
  target_user_id uuid,
  moderation_action text
)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare target_session public.radio_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if moderation_action not in ('mute', 'unmute', 'remove') then raise exception 'RADIO_LISTENER_ACTION_INVALID' using errcode = '22023'; end if;
  select * into target_session from public.radio_sessions session where session.id = target_session_id;
  if target_session.id is null then raise exception 'RADIO_SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.can_manage_radio_session(target_session_id) then raise exception 'RADIO_LISTENER_MODERATION_DENIED' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.radio_listeners listener
    where listener.radio_session_id = target_session_id and listener.user_id = target_user_id and listener.left_at is null
  ) then raise exception 'RADIO_LISTENER_NOT_ACTIVE' using errcode = 'P0002'; end if;

  update public.radio_listeners listener
  set muted = case when moderation_action = 'mute' then true when moderation_action = 'unmute' then false else listener.muted end,
      left_at = case when moderation_action = 'remove' then now() else listener.left_at end,
      last_heartbeat_at = now()
  where listener.radio_session_id = target_session_id and listener.user_id = target_user_id and listener.left_at is null;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_session.community_id, auth.uid(), 'moderation_action', 'radio_listener', target_user_id, 'Radio listener action: ' || moderation_action);
  return true;
end;
$$;

create or replace function public.audit_radio_session_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare event_target text; event_reason text;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    event_target := 'radio_session_create'; event_reason := 'Radio session created';
  elsif new.status is distinct from old.status then
    event_target := 'radio_session_status'; event_reason := 'Radio session status changed from ' || old.status || ' to ' || new.status;
  else
    event_target := 'radio_session_update'; event_reason := 'Radio session schedule or production metadata updated';
  end if;
  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(new.community_id, auth.uid(), 'community_update', event_target, new.id, event_reason);
  return new;
end;
$$;

drop trigger if exists radio_session_create_audit on public.radio_sessions;
create trigger radio_session_create_audit after insert on public.radio_sessions
for each row execute function public.audit_radio_session_change();
drop trigger if exists radio_session_management_audit on public.radio_sessions;
create trigger radio_session_management_audit
after update of title, description, starts_at, scheduled_end_at, cover_storage_path, program_id, status on public.radio_sessions
for each row execute function public.audit_radio_session_change();

revoke all on function public.assign_radio_session_host(uuid, uuid, text) from public, anon;
revoke all on function public.transition_radio_session(uuid, text, text) from public, anon;
revoke all on function public.moderate_radio_listener(uuid, uuid, text) from public, anon;
grant execute on function public.assign_radio_session_host(uuid, uuid, text) to authenticated;
grant execute on function public.transition_radio_session(uuid, text, text) to authenticated;
grant execute on function public.moderate_radio_listener(uuid, uuid, text) to authenticated;

comment on function public.transition_radio_session(uuid, text, text) is 'Permission-checked Radio lifecycle transition. End and cancel require the exact session title.';
comment on function public.moderate_radio_listener(uuid, uuid, text) is 'Host/producer-only active listener moderation with audit evidence.';
commit;
