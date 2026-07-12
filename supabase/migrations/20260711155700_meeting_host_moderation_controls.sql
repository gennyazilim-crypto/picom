begin;

alter table public.meeting_session_participants add column if not exists screen_share_allowed boolean not null default true;

create or replace function public.get_meeting_host_control_state(target_room_id uuid,target_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare room_record public.meeting_rooms%rowtype; session_record public.meeting_sessions%rowtype;
begin
  if auth.uid() is null or not public.can_view_meeting_room(target_room_id) then raise exception 'MEETING_VIEW_FORBIDDEN' using errcode='42501'; end if;
  select * into room_record from public.meeting_rooms where id=target_room_id;
  select * into session_record from public.meeting_sessions where id=target_session_id and room_id=target_room_id;
  if room_record.id is null or session_record.id is null then raise exception 'MEETING_SESSION_NOT_FOUND' using errcode='22023'; end if;
  return jsonb_build_object('roomId',room_record.id,'sessionId',session_record.id,'roomStatus',room_record.status,'sessionStatus',session_record.status,'locked',room_record.status='locked','hostUserId',room_record.host_user_id,'cohostUserIds',room_record.cohost_user_ids,'updatedAt',greatest(room_record.updated_at,session_record.updated_at));
end;$$;

create or replace function public.set_meeting_participant_cohost(target_participant_id uuid,target_enabled boolean,change_reason text)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare participant_record public.meeting_session_participants%rowtype; session_record public.meeting_sessions%rowtype; room_record public.meeting_rooms%rowtype; next_role text;
begin
  if auth.uid() is null or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'MEETING_COHOST_CHANGE_INVALID' using errcode='22023'; end if;
  select * into participant_record from public.meeting_session_participants where id=target_participant_id and state in('joining','connected','reconnecting') for update;
  select * into session_record from public.meeting_sessions where id=participant_record.session_id;
  select * into room_record from public.meeting_rooms where id=session_record.room_id for update;
  if participant_record.id is null or participant_record.user_id is null or public.meeting_role_for_user(room_record.id,auth.uid())<>'host' or participant_record.user_id=auth.uid() or participant_record.user_id=room_record.host_user_id then raise exception 'MEETING_COHOST_CHANGE_FORBIDDEN' using errcode='42501'; end if;
  next_role:=case when target_enabled then 'cohost' else 'participant' end;
  if not public.can_manage_meeting_participant(participant_record.id,next_role) then raise exception 'MEETING_ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  update public.meeting_rooms set cohost_user_ids=case when target_enabled then array(select distinct item from unnest(array_append(cohost_user_ids,participant_record.user_id)) item) else array_remove(cohost_user_ids,participant_record.user_id) end,updated_at=now() where id=room_record.id returning * into room_record;
  update public.meeting_session_participants set role=next_role,updated_at=now() where id=participant_record.id;
  insert into public.meeting_events(room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at) values(room_record.id,session_record.id,auth.uid(),'participant_role_changed','backend','cohost-change:'||target_participant_id::text||':'||txid_current()::text,session_record.last_event_sequence+1,jsonb_build_object('participantId',target_participant_id,'role',next_role),now());
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id) values(room_record.community_id,auth.uid(),'meeting_control','meeting_participant',target_participant_id,left(change_reason,500),room_record.id,session_record.id);
  return jsonb_build_object('participantId',target_participant_id,'role',next_role,'cohostUserIds',room_record.cohost_user_ids);
end;$$;

create or replace function public.transfer_meeting_host(target_participant_id uuid,change_reason text)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare participant_record public.meeting_session_participants%rowtype; actor_participant public.meeting_session_participants%rowtype; session_record public.meeting_sessions%rowtype; room_record public.meeting_rooms%rowtype; previous_host uuid;
begin
  if auth.uid() is null or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'MEETING_HOST_TRANSFER_INVALID' using errcode='22023'; end if;
  select * into participant_record from public.meeting_session_participants where id=target_participant_id and state in('joining','connected','reconnecting') for update;
  select * into session_record from public.meeting_sessions where id=participant_record.session_id;
  select * into room_record from public.meeting_rooms where id=session_record.room_id for update;
  if participant_record.id is null or participant_record.user_id is null or room_record.host_user_id<>auth.uid() or participant_record.user_id=auth.uid() then raise exception 'MEETING_HOST_TRANSFER_FORBIDDEN' using errcode='42501'; end if;
  if public.meeting_role_rank(participant_record.role)>=public.meeting_role_rank('host') then raise exception 'MEETING_ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  previous_host:=room_record.host_user_id;
  select * into actor_participant from public.meeting_session_participants where session_id=session_record.id and user_id=previous_host and state in('joining','connected','reconnecting') for update;
  update public.meeting_rooms set host_user_id=participant_record.user_id,cohost_user_ids=array(select distinct item from unnest(array_append(array_remove(cohost_user_ids,participant_record.user_id),previous_host)) item),updated_at=now() where id=room_record.id;
  update public.meeting_session_participants set role='host',updated_at=now() where id=participant_record.id;
  if actor_participant.id is not null then update public.meeting_session_participants set role='cohost',updated_at=now() where id=actor_participant.id; end if;
  insert into public.meeting_events(room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at) values(room_record.id,session_record.id,auth.uid(),'host_transferred','backend','host-transfer:'||target_participant_id::text||':'||txid_current()::text,session_record.last_event_sequence+1,jsonb_build_object('previousHostUserId',previous_host,'hostUserId',participant_record.user_id),now());
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id) values(room_record.community_id,auth.uid(),'meeting_control','meeting_participant',target_participant_id,left(change_reason,500),room_record.id,session_record.id);
  return jsonb_build_object('participantId',target_participant_id,'hostUserId',participant_record.user_id,'previousHostUserId',previous_host);
end;$$;

create or replace function public.set_meeting_participant_screen_share_policy(target_participant_id uuid,target_allowed boolean,change_reason text)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare participant_record public.meeting_session_participants%rowtype; session_record public.meeting_sessions%rowtype; room_record public.meeting_rooms%rowtype;
begin
  if auth.uid() is null or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'MEETING_SCREEN_POLICY_INVALID' using errcode='22023'; end if;
  select * into participant_record from public.meeting_session_participants where id=target_participant_id and state in('joining','connected','reconnecting') for update;
  select * into session_record from public.meeting_sessions where id=participant_record.session_id;
  select * into room_record from public.meeting_rooms where id=session_record.room_id;
  if participant_record.id is null or participant_record.user_id=auth.uid() or not public.can_manage_meeting_participant(participant_record.id,participant_record.role) then raise exception 'MEETING_SCREEN_POLICY_FORBIDDEN' using errcode='42501'; end if;
  update public.meeting_session_participants set screen_share_allowed=target_allowed,capabilities=jsonb_set(capabilities,'{canShareScreen}',to_jsonb(target_allowed),true),updated_at=now() where id=target_participant_id;
  insert into public.meeting_events(room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at) values(room_record.id,session_record.id,auth.uid(),'participant_screen_policy_changed','backend','screen-policy:'||target_participant_id::text||':'||txid_current()::text,session_record.last_event_sequence+1,jsonb_build_object('participantId',target_participant_id,'allowed',target_allowed),now());
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id) values(room_record.community_id,auth.uid(),'meeting_control','meeting_participant',target_participant_id,left(change_reason,500),room_record.id,session_record.id);
  return jsonb_build_object('participantId',target_participant_id,'screenShareAllowed',target_allowed);
end;$$;

create or replace function public.enforce_my_meeting_media_policy(target_room_id uuid,target_session_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare participant_record public.meeting_session_participants%rowtype;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  select participant.* into participant_record from public.meeting_session_participants participant join public.meeting_sessions session on session.id=participant.session_id where participant.session_id=target_session_id and session.room_id=target_room_id and participant.user_id=auth.uid() for update;
  if participant_record.id is null then raise exception 'MEETING_PARTICIPANT_NOT_FOUND' using errcode='42501'; end if;
  update public.meeting_session_participants set capabilities=jsonb_set(capabilities,'{canShareScreen}',to_jsonb(participant_record.screen_share_allowed),true),updated_at=now() where id=participant_record.id;
  return jsonb_build_object('screenShareAllowed',participant_record.screen_share_allowed);
end;$$;

create or replace function public.cancel_scheduled_meeting_room(target_room_id uuid,cancellation_reason text)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare room_record public.meeting_rooms%rowtype;
begin
  if auth.uid() is null or char_length(btrim(cancellation_reason)) not between 10 and 500 then raise exception 'MEETING_CANCELLATION_INVALID' using errcode='22023'; end if;
  select * into room_record from public.meeting_rooms where id=target_room_id for update;
  if room_record.id is null or room_record.status<>'scheduled' or not (room_record.host_user_id=auth.uid() or (public.authorize_meeting_action(target_room_id,'manage')->>'authorized')::boolean) then raise exception 'MEETING_CANCELLATION_FORBIDDEN' using errcode='42501'; end if;
  if exists(select 1 from public.meeting_sessions where room_id=target_room_id and status in('preparing','live','reconnecting')) then raise exception 'MEETING_ACTIVE_SESSION_CONFLICT' using errcode='55000'; end if;
  update public.meeting_rooms set status='cancelled',locked_at=null,locked_by_user_id=null,updated_at=now() where id=target_room_id;
  update public.community_events set cancelled_at=coalesce(cancelled_at,now()),updated_at=now() where id=room_record.event_id;
  update public.meeting_invites set status='revoked',revoked_at=coalesce(revoked_at,now()),updated_at=now() where room_id=target_room_id and status='active';
  update public.meeting_waiting_entries set status='cancelled',cancelled_at=coalesce(cancelled_at,now()),resolved_at=coalesce(resolved_at,now()),decision_note='Meeting cancelled by host.',updated_at=now() where room_id=target_room_id and status='waiting';
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id) values(room_record.community_id,auth.uid(),'meeting_control','meeting_room',target_room_id,left(cancellation_reason,500),target_room_id);
  return jsonb_build_object('roomId',target_room_id,'status','cancelled');
end;$$;

create or replace function public.reconcile_meeting_host_departure()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare session_record public.meeting_sessions%rowtype; room_record public.meeting_rooms%rowtype; successor public.meeting_session_participants%rowtype;
begin
  if old.state not in('joining','connected','reconnecting') or new.state not in('left','removed') or old.user_id is null then return new; end if;
  select * into session_record from public.meeting_sessions where id=new.session_id for update;
  select * into room_record from public.meeting_rooms where id=session_record.room_id for update;
  if room_record.host_user_id<>old.user_id or session_record.status not in('preparing','live','reconnecting') then return new; end if;
  select participant.* into successor from public.meeting_session_participants participant where participant.session_id=new.session_id and participant.id<>new.id and participant.state in('joining','connected','reconnecting') and participant.role='cohost' and participant.user_id is not null order by participant.joined_at nulls last,participant.created_at limit 1 for update;
  if successor.id is not null then
    update public.meeting_rooms set host_user_id=successor.user_id,cohost_user_ids=array_remove(cohost_user_ids,successor.user_id),updated_at=now() where id=room_record.id;
    update public.meeting_session_participants set role='host',updated_at=now() where id=successor.id;
    insert into public.meeting_events(room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at) values(room_record.id,session_record.id,old.user_id,'host_transferred','backend','host-disconnect:'||new.id::text||':'||txid_current()::text,session_record.last_event_sequence+1,jsonb_build_object('previousHostUserId',old.user_id,'hostUserId',successor.user_id,'automatic',true),now());
    insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id) values(room_record.community_id,old.user_id,'meeting_control','meeting_participant',successor.id,'Automatic host transfer after host disconnect',room_record.id,session_record.id);
  else
    update public.meeting_rooms set status='ended',ended_at=coalesce(ended_at,now()),ended_by_user_id=old.user_id,locked_at=null,locked_by_user_id=null,updated_at=now() where id=room_record.id;
    update public.meeting_sessions set status='ended',connection_state='disconnected',ended_at=coalesce(ended_at,now()),ended_by_user_id=old.user_id,updated_at=now() where id=session_record.id;
    update public.meeting_session_participants set state='left',left_at=coalesce(left_at,now()),updated_at=now() where session_id=session_record.id and state in('joining','connected','reconnecting');
    insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id) values(room_record.community_id,old.user_id,'meeting_control','meeting_session',session_record.id,'Meeting ended because the last eligible host left',room_record.id,session_record.id);
  end if;
  return new;
end;$$;

drop trigger if exists meeting_host_departure_reconciliation on public.meeting_session_participants;
create trigger meeting_host_departure_reconciliation after update of state on public.meeting_session_participants for each row execute function public.reconcile_meeting_host_departure();

revoke all on function public.get_meeting_host_control_state(uuid,uuid),public.set_meeting_participant_cohost(uuid,boolean,text),public.transfer_meeting_host(uuid,text),public.set_meeting_participant_screen_share_policy(uuid,boolean,text),public.enforce_my_meeting_media_policy(uuid,uuid),public.cancel_scheduled_meeting_room(uuid,text) from public,anon;
grant execute on function public.get_meeting_host_control_state(uuid,uuid),public.set_meeting_participant_cohost(uuid,boolean,text),public.transfer_meeting_host(uuid,text),public.set_meeting_participant_screen_share_policy(uuid,boolean,text),public.enforce_my_meeting_media_policy(uuid,uuid),public.cancel_scheduled_meeting_room(uuid,text) to authenticated;

commit;
