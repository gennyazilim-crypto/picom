-- Task 540: ephemeral LiveKit reactions plus authoritative hand/stage state.

alter table public.meeting_participant_runtime_state
  add column if not exists acknowledged_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists stage_request_status text not null default 'none',
  add column if not exists stage_requested_at timestamptz,
  add column if not exists stage_resolved_at timestamptz,
  add column if not exists stage_resolved_by_user_id uuid references public.profiles(id) on delete set null;
do $$ begin alter table public.meeting_participant_runtime_state add constraint meeting_runtime_stage_status_safe check(stage_request_status in ('none','requested','approved','denied','cancelled')); exception when duplicate_object then null; end $$;
do $$ begin alter table public.meeting_participant_runtime_state add constraint meeting_runtime_ack_consistent check((acknowledged_by_user_id is null and acknowledged_at is null) or (acknowledged_by_user_id is not null and acknowledged_at is not null)); exception when duplicate_object then null; end $$;
do $$ begin alter table public.meeting_participant_runtime_state add constraint meeting_runtime_stage_time_consistent check((stage_request_status in ('none','requested') and stage_resolved_at is null) or (stage_request_status in ('approved','denied','cancelled') and stage_resolved_at is not null)); exception when duplicate_object then null; end $$;
alter table public.user_action_rate_limits drop constraint if exists user_action_rate_limits_action_key_check;
alter table public.user_action_rate_limits add constraint user_action_rate_limits_action_key_check check(action_key in('message_send','attachment_metadata','reaction_write','relationship_write','feed_interaction','livekit_token','meeting_schedule_write','meeting_invite_write','meeting_join_preview','meeting_signal_write'));
create or replace function public.consume_current_user_action_rate_limit(target_action text)
returns table(is_allowed boolean,retry_after_seconds integer)
language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare current_user_id uuid:=auth.uid();configured_maximum_requests integer;configured_window_seconds integer;current_row public.user_action_rate_limits%rowtype;current_time timestamptz:=clock_timestamp();
begin
  if current_user_id is null then return query select false,60;return;end if;
  select configured.maximum_requests,configured.window_seconds into configured_maximum_requests,configured_window_seconds
  from(values('message_send',30,60),('attachment_metadata',20,300),('reaction_write',120,60),('relationship_write',30,60),('feed_interaction',120,60),('livekit_token',10,60),('meeting_schedule_write',20,300),('meeting_invite_write',30,300),('meeting_join_preview',60,60),('meeting_signal_write',12,60))configured(action_key,maximum_requests,window_seconds)
  where configured.action_key=target_action;
  if configured_maximum_requests is null then raise exception 'RATE_LIMIT_ACTION_INVALID';end if;
  insert into public.user_action_rate_limits(user_id,action_key,window_started_at,request_count,updated_at) values(current_user_id,target_action,current_time,1,current_time)
  on conflict(user_id,action_key) do update set window_started_at=case when user_action_rate_limits.window_started_at<=current_time-make_interval(secs=>configured_window_seconds) then current_time else user_action_rate_limits.window_started_at end,request_count=case when user_action_rate_limits.window_started_at<=current_time-make_interval(secs=>configured_window_seconds) then 1 else user_action_rate_limits.request_count+1 end,updated_at=current_time returning * into current_row;
  if current_row.request_count>configured_maximum_requests then update public.user_action_rate_limits set denied_count=denied_count+1,last_denied_at=current_time,updated_at=current_time where user_id=current_user_id and action_key=target_action;end if;
  return query select current_row.request_count<=configured_maximum_requests,case when current_row.request_count<=configured_maximum_requests then 0 else greatest(1,ceil(extract(epoch from(current_row.window_started_at+make_interval(secs=>configured_window_seconds)-current_time)))::integer) end;
end;
$$;
create or replace function public.update_meeting_hand_signal(target_participant_id uuid,target_action text)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare actor_id uuid:=auth.uid();participant_record public.meeting_session_participants%rowtype;session_record public.meeting_sessions%rowtype;room_record public.meeting_rooms%rowtype;runtime_record public.meeting_participant_runtime_state%rowtype;manager boolean:=false;own_participant boolean:=false;next_sequence bigint:=0;event_sequence bigint;
begin
  if actor_id is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501';end if;
  perform public.consume_meeting_request_limit('meeting_signal_write');
  if target_action not in('raise','lower','acknowledge','request_stage','cancel_stage','approve_stage','deny_stage') then raise exception 'MEETING_HAND_ACTION_INVALID' using errcode='22023';end if;
  select * into participant_record from public.meeting_session_participants where id=target_participant_id for update;
  select * into session_record from public.meeting_sessions where id=participant_record.session_id;
  select * into room_record from public.meeting_rooms where id=session_record.room_id and archived_at is null;
  if participant_record.id is null or session_record.id is null or room_record.id is null or participant_record.state not in('joining','connected','reconnecting') then raise exception 'MEETING_PARTICIPANT_NOT_ACTIVE' using errcode='22023';end if;
  own_participant:=participant_record.user_id=actor_id;manager:=public.can_manage_meeting_participant(participant_record.id,participant_record.role);
  if target_action in('raise','request_stage') and not own_participant then raise exception 'MEETING_HAND_SELF_REQUIRED' using errcode='42501';end if;
  if target_action='cancel_stage' and not(own_participant or manager) then raise exception 'MEETING_STAGE_CANCEL_FORBIDDEN' using errcode='42501';end if;
  if target_action='lower' and not(own_participant or manager) then raise exception 'MEETING_HAND_LOWER_FORBIDDEN' using errcode='42501';end if;
  if target_action in('acknowledge','approve_stage','deny_stage') and not manager then raise exception 'MEETING_HAND_MANAGER_REQUIRED' using errcode='42501';end if;
  if target_action='request_stage' and not(room_record.mode='stage' or coalesce(room_record.audience_mode,false)) then raise exception 'MEETING_STAGE_REQUEST_UNAVAILABLE' using errcode='22023';end if;
  select coalesce(max(runtime.hand_sequence),0)+1 into next_sequence from public.meeting_participant_runtime_state runtime where runtime.session_id=participant_record.session_id;
  insert into public.meeting_participant_runtime_state(participant_id,session_id,updated_by_user_id,updated_at) values(participant_record.id,participant_record.session_id,actor_id,now()) on conflict(participant_id) do nothing;
  select * into runtime_record from public.meeting_participant_runtime_state where participant_id=participant_record.id for update;
  if target_action='raise' then
    update public.meeting_participant_runtime_state set hand_raised=true,hand_raised_at=case when hand_raised then hand_raised_at else now() end,hand_sequence=case when hand_raised then hand_sequence else next_sequence end,acknowledged_by_user_id=null,acknowledged_at=null,server_version=server_version+1,updated_by_user_id=actor_id,updated_at=now() where participant_id=participant_record.id;
  elsif target_action='lower' then
    update public.meeting_participant_runtime_state set hand_raised=false,hand_raised_at=null,hand_sequence=0,acknowledged_by_user_id=null,acknowledged_at=null,stage_request_status=case when stage_request_status='requested' then 'cancelled' else stage_request_status end,stage_resolved_at=case when stage_request_status='requested' then now() else stage_resolved_at end,stage_resolved_by_user_id=case when stage_request_status='requested' then actor_id else stage_resolved_by_user_id end,server_version=server_version+1,updated_by_user_id=actor_id,updated_at=now() where participant_id=participant_record.id;
  elsif target_action='acknowledge' then
    if not runtime_record.hand_raised then raise exception 'MEETING_HAND_NOT_RAISED' using errcode='22023';end if;
    update public.meeting_participant_runtime_state set acknowledged_by_user_id=actor_id,acknowledged_at=now(),server_version=server_version+1,updated_by_user_id=actor_id,updated_at=now() where participant_id=participant_record.id;
  elsif target_action='request_stage' then
    update public.meeting_participant_runtime_state set hand_raised=true,hand_raised_at=case when hand_raised then hand_raised_at else now() end,hand_sequence=case when hand_raised then hand_sequence else next_sequence end,acknowledged_by_user_id=null,acknowledged_at=null,stage_request_status='requested',stage_requested_at=now(),stage_resolved_at=null,stage_resolved_by_user_id=null,server_version=server_version+1,updated_by_user_id=actor_id,updated_at=now() where participant_id=participant_record.id;
  elsif target_action='cancel_stage' then
    if runtime_record.stage_request_status<>'requested' then raise exception 'MEETING_STAGE_REQUEST_NOT_PENDING' using errcode='22023';end if;
    update public.meeting_participant_runtime_state set stage_request_status='cancelled',stage_resolved_at=now(),stage_resolved_by_user_id=actor_id,server_version=server_version+1,updated_by_user_id=actor_id,updated_at=now() where participant_id=participant_record.id;
  elsif target_action in('approve_stage','deny_stage') then
    if runtime_record.stage_request_status<>'requested' then raise exception 'MEETING_STAGE_REQUEST_NOT_PENDING' using errcode='22023';end if;
    update public.meeting_participant_runtime_state set stage_request_status=case when target_action='approve_stage' then 'approved' else 'denied' end,stage_resolved_at=now(),stage_resolved_by_user_id=actor_id,acknowledged_by_user_id=actor_id,acknowledged_at=now(),server_version=server_version+1,updated_by_user_id=actor_id,updated_at=now() where participant_id=participant_record.id;
  end if;
  if target_action in('acknowledge','request_stage','cancel_stage','approve_stage','deny_stage') then
    update public.meeting_sessions set last_event_sequence=last_event_sequence+1,updated_at=now() where id=session_record.id returning last_event_sequence into event_sequence;
    insert into public.meeting_events(room_id,session_id,actor_user_id,actor_participant_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at) values(room_record.id,session_record.id,actor_id,participant_record.id,'meeting_hand_signal','backend','hand:'||gen_random_uuid()::text,event_sequence,jsonb_build_object('action',target_action),now());
  end if;
  select * into runtime_record from public.meeting_participant_runtime_state where participant_id=participant_record.id;
  return jsonb_build_object('participantId',participant_record.id,'sessionId',participant_record.session_id,'handRaised',runtime_record.hand_raised,'handRaisedAt',runtime_record.hand_raised_at,'handSequence',runtime_record.hand_sequence,'acknowledgedByUserId',runtime_record.acknowledged_by_user_id,'acknowledgedAt',runtime_record.acknowledged_at,'stageRequestStatus',runtime_record.stage_request_status,'stageRequestedAt',runtime_record.stage_requested_at,'stageResolvedAt',runtime_record.stage_resolved_at,'stageResolvedByUserId',runtime_record.stage_resolved_by_user_id,'serverVersion',runtime_record.server_version,'updatedAt',runtime_record.updated_at);
end;
$$;
revoke all on function public.update_meeting_hand_signal(uuid,text) from public,anon;
grant execute on function public.update_meeting_hand_signal(uuid,text) to authenticated;
revoke execute on function public.set_meeting_participant_hand_state(uuid,boolean) from authenticated;
create or replace function public.get_meeting_hand_queue(target_room_id uuid,target_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare session_sequence bigint;queue_json jsonb;
begin
  if auth.uid() is null or not public.can_view_meeting_sensitive(target_room_id) then raise exception 'MEETING_HAND_QUEUE_FORBIDDEN' using errcode='42501';end if;
  select last_event_sequence into session_sequence from public.meeting_sessions where id=target_session_id and room_id=target_room_id;
  if session_sequence is null then raise exception 'MEETING_SESSION_NOT_FOUND' using errcode='22023';end if;
  select coalesce(jsonb_agg(jsonb_build_object('participantId',participant.id,'userId',participant.user_id,'displayName',participant.display_name,'meetingRole',participant.role,'handRaised',runtime.hand_raised,'handRaisedAt',runtime.hand_raised_at,'handSequence',runtime.hand_sequence,'acknowledgedByUserId',runtime.acknowledged_by_user_id,'acknowledgedAt',runtime.acknowledged_at,'stageRequestStatus',runtime.stage_request_status,'stageRequestedAt',runtime.stage_requested_at,'stageResolvedAt',runtime.stage_resolved_at,'stageResolvedByUserId',runtime.stage_resolved_by_user_id,'serverVersion',runtime.server_version,'updatedAt',runtime.updated_at) order by case when runtime.stage_request_status='requested' then 0 else 1 end,runtime.hand_sequence,participant.id),'[]'::jsonb) into queue_json
  from public.meeting_participant_runtime_state runtime join public.meeting_session_participants participant on participant.id=runtime.participant_id where runtime.session_id=target_session_id and participant.state in('joining','connected','reconnecting') and(runtime.hand_raised or runtime.stage_request_status<>'none');
  return jsonb_build_object('schemaVersion',1,'roomId',target_room_id,'sessionId',target_session_id,'sessionSequence',session_sequence,'generatedAt',now(),'entries',queue_json);
end;
$$;
revoke all on function public.get_meeting_hand_queue(uuid,uuid) from public,anon;
grant execute on function public.get_meeting_hand_queue(uuid,uuid) to authenticated;
create or replace function public.close_meeting_signal_on_participant_exit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.state in('left','removed') and old.state is distinct from new.state then
    update public.meeting_participant_runtime_state set hand_raised=false,hand_raised_at=null,hand_sequence=0,acknowledged_by_user_id=null,acknowledged_at=null,stage_request_status=case when stage_request_status='requested' then 'cancelled' else stage_request_status end,stage_resolved_at=case when stage_request_status='requested' then now() else stage_resolved_at end,stage_resolved_by_user_id=null,server_version=server_version+1,updated_at=now() where participant_id=new.id;
  end if;return new;
end;
$$;
revoke all on function public.close_meeting_signal_on_participant_exit() from public,anon,authenticated;
drop trigger if exists close_meeting_signal_on_participant_exit on public.meeting_session_participants;
create trigger close_meeting_signal_on_participant_exit after update of state on public.meeting_session_participants for each row execute function public.close_meeting_signal_on_participant_exit();
