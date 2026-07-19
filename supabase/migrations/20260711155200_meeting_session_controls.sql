begin;
create or replace function public.control_meeting_session(
  target_room_id uuid,
  target_session_id uuid,
  control_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  room_record public.meeting_rooms%rowtype;
  session_record public.meeting_sessions%rowtype;
  actor_role text;
  next_status text;
  event_type text;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  if control_action not in ('lock','unlock','end') then raise exception 'MEETING_CONTROL_INVALID' using errcode='22023'; end if;
  perform public.authorize_meeting_action(target_room_id,'manage');
  actor_role := public.meeting_role_for_user(target_room_id,auth.uid());
  if control_action in ('lock','unlock') and actor_role not in ('host','cohost') then raise exception 'MEETING_CONTROL_FORBIDDEN' using errcode='42501'; end if;
  if control_action='end' and actor_role<>'host' then raise exception 'MEETING_END_FORBIDDEN' using errcode='42501'; end if;

  select * into room_record from public.meeting_rooms where id=target_room_id for update;
  select * into session_record from public.meeting_sessions where id=target_session_id and room_id=target_room_id for update;
  if room_record.id is null or session_record.id is null then raise exception 'MEETING_SESSION_NOT_FOUND' using errcode='P0002'; end if;
  if session_record.status in ('ended','failed') then raise exception 'MEETING_SESSION_ENDED' using errcode='22023'; end if;

  if control_action='lock' then
    update public.meeting_rooms set metadata=jsonb_set(metadata,'{statusBeforeLock}',to_jsonb(status),true),status='locked',locked_at=now(),locked_by_user_id=auth.uid(),updated_at=now() where id=target_room_id;
    next_status:='locked'; event_type:='room_status_changed';
  elsif control_action='unlock' then
    next_status:=case when room_record.metadata->>'statusBeforeLock' in ('scheduled','open','live') then room_record.metadata->>'statusBeforeLock' when session_record.status='live' then 'live' else 'open' end;
    update public.meeting_rooms set metadata=metadata-'statusBeforeLock',status=next_status,locked_at=null,locked_by_user_id=null,updated_at=now() where id=target_room_id;
    event_type:='room_status_changed';
  else
    update public.meeting_rooms set status='ended',ended_at=now(),ended_by_user_id=auth.uid(),locked_at=null,locked_by_user_id=null,updated_at=now() where id=target_room_id;
    update public.meeting_sessions set status='ended',connection_state='disconnected',ended_at=now(),ended_by_user_id=auth.uid(),updated_at=now() where id=target_session_id;
    update public.meeting_session_participants set state='left',left_at=coalesce(left_at,now()),updated_at=now() where session_id=target_session_id and state not in ('left','removed');
    next_status:='ended'; event_type:='session_ended';
  end if;

  update public.meeting_sessions set last_event_sequence=last_event_sequence+1,updated_at=now() where id=target_session_id returning last_event_sequence into session_record.last_event_sequence;
  insert into public.meeting_events(room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at)
  values(target_room_id,target_session_id,auth.uid(),event_type,'backend','meeting-control-'||target_session_id::text||'-'||txid_current()::text,session_record.last_event_sequence,jsonb_build_object('action',control_action,'status',next_status),now());
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id)
  values(room_record.community_id,auth.uid(),'meeting_control','meeting_session',target_session_id,'Meeting control: '||control_action,target_room_id,target_session_id);
  return jsonb_build_object('roomId',target_room_id,'sessionId',target_session_id,'action',control_action,'status',next_status,'locked',next_status='locked','ended',next_status='ended');
end;
$$;
revoke all on function public.control_meeting_session(uuid,uuid,text) from public,anon;
grant execute on function public.control_meeting_session(uuid,uuid,text) to authenticated;
comment on function public.control_meeting_session(uuid,uuid,text) is 'Host-authorized lock/unlock/end controls with ordered event and audit evidence.';
commit;
