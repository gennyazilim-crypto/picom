-- Task 532: least-privilege meeting RLS, capability authorization, and hierarchy-safe mutations.
begin;

insert into public.community_permission_definitions(permission_key,category,allowed_kinds,delegable,owner_reserved,description) values
('createMeeting','meeting',array['text','radio','podcast'],true,false,'Create approved meeting rooms in this community.'),
('manageMeeting','meeting',array['text','radio','podcast'],true,false,'Manage meeting lifecycle, policy, and configuration.'),
('joinMeeting','meeting',array['text','radio','podcast'],true,false,'Join accessible open meetings.'),
('publishAudio','meeting',array['text','radio','podcast'],true,false,'Publish microphone audio in an accessible meeting.'),
('publishVideo','meeting',array['text','radio','podcast'],true,false,'Publish camera video in an accessible meeting.'),
('shareScreen','meeting',array['text','radio','podcast'],true,false,'Publish an approved screen-share track.'),
('admitGuests','meeting',array['text','radio','podcast'],true,false,'Admit or deny waiting-room guests.'),
('manageParticipants','meeting',array['text','radio','podcast'],true,false,'Moderate lower-ranked meeting participants.'),
('manageStage','meeting',array['text','radio','podcast'],true,false,'Promote and demote lower-ranked stage participants.'),
('viewMeetingHistory','meeting',array['text','radio','podcast'],true,false,'View privacy-bounded meeting history and attendance.'),
('enableCaptions','meeting',array['text','radio','podcast'],true,false,'Enable a configured consent-gated captions provider.')
on conflict(permission_key) do update set category=excluded.category,allowed_kinds=excluded.allowed_kinds,delegable=excluded.delegable,owner_reserved=excluded.owner_reserved,description=excluded.description,updated_at=now();

insert into public.community_role_permissions(community_id,role_id,permission_key,allowed)
select role.community_id,role.id,permission_key,true
from public.roles role
cross join lateral unnest(case
  when role.system_key='owner' then array['createMeeting','manageMeeting','joinMeeting','publishAudio','publishVideo','shareScreen','admitGuests','manageParticipants','manageStage','viewMeetingHistory','enableCaptions']::text[]
  when role.system_key='admin' then array['createMeeting','manageMeeting','joinMeeting','publishAudio','publishVideo','shareScreen','admitGuests','manageParticipants','manageStage','viewMeetingHistory','enableCaptions']::text[]
  when role.system_key='moderator' then array['joinMeeting','publishAudio','publishVideo','shareScreen','manageParticipants','manageStage','viewMeetingHistory']::text[]
  when role.system_key='member' then array['joinMeeting','publishAudio','publishVideo']::text[]
  else array[]::text[] end
) permission_key
on conflict(role_id,permission_key) do nothing;

create or replace function public.meeting_role_rank(target_role text)
returns integer language sql immutable set search_path=public,pg_temp as $$
  select case target_role when 'host' then 100 when 'cohost' then 80 when 'speaker' then 50 when 'participant' then 30 when 'viewer' then 10 when 'guest' then 0 else -1 end;
$$;

create or replace function public.meeting_role_for_user(target_room_id uuid,target_user_id uuid)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; system_role text; participant_role text; invite_role text;
begin
  if target_user_id is null then return 'guest'; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id;
  if target_room.id is null then return 'guest'; end if;
  if exists(select 1 from public.communities where id=target_room.community_id and owner_id=target_user_id) then return 'host'; end if;

  select participant.role into participant_role
  from public.meeting_session_participants participant
  join public.meeting_sessions session on session.id=participant.session_id
  where session.room_id=target_room_id and participant.user_id=target_user_id and participant.state in ('joining','connected','reconnecting')
  order by public.meeting_role_rank(participant.role) desc,participant.created_at desc limit 1;
  if participant_role is not null then return participant_role; end if;

  select role.system_key into system_role
  from public.community_members member
  join public.roles role on role.community_id=member.community_id and (
    role.id=member.role_id or role.id in (select link.role_id from public.community_member_roles link where link.member_id=member.id)
  )
  where member.community_id=target_room.community_id and member.user_id=target_user_id
  order by role.level desc limit 1;
  if system_role='admin' then return 'cohost'; end if;
  if system_role='moderator' then return 'speaker'; end if;
  if system_role is not null then return target_room.default_role; end if;

  select invite.role into invite_role from public.meeting_invites invite
  where invite.room_id=target_room_id and invite.invited_user_id=target_user_id and invite.status='active' and (invite.expires_at is null or invite.expires_at>now())
  order by public.meeting_role_rank(invite.role) desc,invite.created_at desc limit 1;
  return coalesce(invite_role,'guest');
end;
$$;

create or replace function public.meeting_user_is_restricted(target_room_id uuid,target_user_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype;
begin
  if target_user_id is null then return true; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id;
  if target_room.id is null then return true; end if;
  return exists(select 1 from public.community_bans where community_id=target_room.community_id and user_id=target_user_id and revoked_at is null)
    or exists(select 1 from public.community_member_timeouts where community_id=target_room.community_id and user_id=target_user_id and expires_at>now())
    or public.users_are_blocked(target_user_id,target_room.host_user_id);
end;
$$;

create or replace function public.can_view_meeting_room(target_room_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype; channel_private boolean:=false; active_invite boolean:=false;
begin
  if auth.uid() is null then return false; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id;
  if target_room.id is null or target_room.status='cancelled' or public.meeting_user_is_restricted(target_room_id,auth.uid()) then return false; end if;
  select * into target_community from public.communities where id=target_room.community_id and archived_at is null;
  if target_community.id is null then return false; end if;
  if target_room.channel_id is not null then select is_private into channel_private from public.channels where id=target_room.channel_id; end if;
  select exists(select 1 from public.meeting_invites where room_id=target_room_id and invited_user_id=auth.uid() and status='active' and (expires_at is null or expires_at>now())) into active_invite;
  if active_invite then return true; end if;
  if public.is_community_member(target_room.community_id) then
    return public.effective_community_permission(target_room.community_id,'joinMeeting','channel',target_room.channel_id)
      or public.effective_community_permission(target_room.community_id,'viewMeetingHistory',null,null)
      or public.effective_community_permission(target_room.community_id,'manageMeeting',null,null);
  end if;
  return target_community.visibility='public' and target_community.public_read_enabled and target_room.join_policy='open' and not coalesce(channel_private,false);
end;
$$;

create or replace function public.can_join_meeting_room(target_room_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; target_community public.communities%rowtype; channel_private boolean:=false; active_invite boolean:=false;
begin
  if auth.uid() is null then return false; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id;
  if target_room.id is null or target_room.status not in ('open','live') or public.meeting_user_is_restricted(target_room_id,auth.uid()) then return false; end if;
  select * into target_community from public.communities where id=target_room.community_id and archived_at is null;
  if target_community.id is null then return false; end if;
  if target_room.channel_id is not null then select is_private into channel_private from public.channels where id=target_room.channel_id; end if;
  select exists(select 1 from public.meeting_invites where room_id=target_room_id and invited_user_id=auth.uid() and status='active' and (expires_at is null or expires_at>now())) into active_invite;
  if active_invite then return true; end if;
  if public.is_community_member(target_room.community_id) then return public.effective_community_permission(target_room.community_id,'joinMeeting','channel',target_room.channel_id); end if;
  return target_community.visibility='public' and target_community.public_read_enabled and target_room.join_policy='open' and not coalesce(channel_private,false);
end;
$$;

create or replace function public.meeting_join_disposition(target_room_id uuid)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype;
begin
  if not public.can_join_meeting_room(target_room_id) then return 'denied'; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id;
  if public.effective_community_permission(target_room.community_id,'manageMeeting',null,null) then return 'direct'; end if;
  if target_room.waiting_room_enabled or target_room.join_policy='approval_required' then return 'waiting'; end if;
  return 'direct';
end;
$$;

create or replace function public.can_view_meeting_sensitive(target_room_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype;
begin
  if auth.uid() is null or not public.can_view_meeting_room(target_room_id) then return false; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id;
  return public.is_community_member(target_room.community_id)
    or exists(select 1 from public.meeting_sessions session join public.meeting_session_participants participant on participant.session_id=session.id where session.room_id=target_room_id and participant.user_id=auth.uid() and participant.state in ('joining','connected','reconnecting'));
end;
$$;

create or replace function public.can_manage_meeting_participant(target_participant_id uuid,proposed_role text default null)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_participant public.meeting_session_participants%rowtype; target_room public.meeting_rooms%rowtype; actor_role text; next_role text;
begin
  if auth.uid() is null then return false; end if;
  select participant.* into target_participant from public.meeting_session_participants participant where participant.id=target_participant_id;
  if target_participant.id is null or target_participant.user_id=auth.uid() then return false; end if;
  select room.* into target_room from public.meeting_sessions session join public.meeting_rooms room on room.id=session.room_id where session.id=target_participant.session_id;
  if target_room.id is null then return false; end if;
  if not (public.effective_community_permission(target_room.community_id,'manageParticipants',null,null) or public.effective_community_permission(target_room.community_id,'manageStage',null,null)) then return false; end if;
  actor_role:=public.meeting_role_for_user(target_room.id,auth.uid());
  next_role:=coalesce(proposed_role,target_participant.role);
  if next_role='host' and not exists(select 1 from public.communities where id=target_room.community_id and owner_id=auth.uid()) then return false; end if;
  return public.meeting_role_rank(actor_role)>public.meeting_role_rank(target_participant.role) and public.meeting_role_rank(actor_role)>public.meeting_role_rank(next_role);
end;
$$;

create or replace function public.authorize_meeting_action(target_room_id uuid,target_action text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare target_room public.meeting_rooms%rowtype; actor_role text; member boolean; allowed boolean:=false; required_permission text;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  select * into target_room from public.meeting_rooms where id=target_room_id;
  if target_room.id is null then raise exception 'MEETING_NOT_FOUND' using errcode='22023'; end if;
  actor_role:=public.meeting_role_for_user(target_room_id,auth.uid());
  member:=public.is_community_member(target_room.community_id);
  required_permission:=case target_action
    when 'create' then 'createMeeting' when 'manage' then 'manageMeeting' when 'join' then 'joinMeeting'
    when 'publish_audio' then 'publishAudio' when 'publish_video' then 'publishVideo' when 'share_screen' then 'shareScreen'
    when 'admit' then 'admitGuests' when 'manage_participants' then 'manageParticipants' when 'manage_stage' then 'manageStage'
    when 'view_history' then 'viewMeetingHistory' when 'enable_captions' then 'enableCaptions' else null end;
  if required_permission is null then raise exception 'MEETING_ACTION_INVALID' using errcode='22023'; end if;
  if target_action='join' then allowed:=public.can_join_meeting_room(target_room_id);
  elsif member then allowed:=public.effective_community_permission(target_room.community_id,required_permission,case when target_action in ('join','publish_audio','publish_video','share_screen') then 'channel' else null end,case when target_action in ('join','publish_audio','publish_video','share_screen') then target_room.channel_id else null end);
  elsif exists(select 1 from public.meeting_invites where room_id=target_room_id and invited_user_id=auth.uid() and status='active' and (expires_at is null or expires_at>now())) then
    allowed:=case target_action when 'publish_audio' then actor_role in ('host','cohost','speaker','participant') when 'publish_video' then actor_role in ('host','cohost','speaker','participant') when 'share_screen' then actor_role in ('host','cohost','speaker') else false end;
  end if;
  if not allowed or public.meeting_user_is_restricted(target_room_id,auth.uid()) then raise exception 'MEETING_ACTION_FORBIDDEN' using errcode='42501'; end if;
  return jsonb_build_object('roomId',target_room_id,'role',actor_role,'action',target_action,'authorized',true,'joinDisposition',case when target_action='join' then public.meeting_join_disposition(target_room_id) else null end);
end;
$$;

create or replace function public.enforce_meeting_participant_hierarchy()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_room_id uuid; assigned_role text;
begin
  if auth.uid() is null then
    if current_user in ('postgres','supabase_admin') or current_setting('request.jwt.claim.role',true)='service_role' then return new; end if;
    raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501';
  end if;
  select room.id into target_room_id from public.meeting_sessions session join public.meeting_rooms room on room.id=session.room_id where session.id=new.session_id;
  if target_room_id is null then raise exception 'MEETING_SESSION_INVALID' using errcode='23503'; end if;
  if tg_op='INSERT' then
    if new.user_id<>auth.uid() then raise exception 'MEETING_PARTICIPANT_INSERT_FORBIDDEN' using errcode='42501'; end if;
    assigned_role:=public.meeting_role_for_user(target_room_id,auth.uid());
    if public.meeting_role_rank(new.role)>public.meeting_role_rank(assigned_role) then raise exception 'MEETING_SELF_ESCALATION_FORBIDDEN' using errcode='42501'; end if;
  elsif new.role is distinct from old.role then
    if not public.can_manage_meeting_participant(old.id,new.role) then raise exception 'MEETING_ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_meeting_participant_hierarchy on public.meeting_session_participants;
create trigger trg_meeting_participant_hierarchy before insert or update of role,user_id,session_id on public.meeting_session_participants for each row execute function public.enforce_meeting_participant_hierarchy();

create or replace function public.set_meeting_participant_role(target_participant_id uuid,next_role text,change_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_participant public.meeting_session_participants%rowtype; target_room public.meeting_rooms%rowtype; previous_role text;
begin
  if next_role not in ('cohost','speaker','participant','viewer','guest') or char_length(btrim(change_reason)) not between 10 and 300 then raise exception 'MEETING_ROLE_CHANGE_INVALID' using errcode='22023'; end if;
  select * into target_participant from public.meeting_session_participants where id=target_participant_id for update;
  if target_participant.id is null or not public.can_manage_meeting_participant(target_participant_id,next_role) then raise exception 'MEETING_ROLE_HIERARCHY_DENIED' using errcode='42501'; end if;
  select room.* into target_room from public.meeting_sessions session join public.meeting_rooms room on room.id=session.room_id where session.id=target_participant.session_id;
  previous_role:=target_participant.role;
  update public.meeting_session_participants set role=next_role,updated_at=now() where id=target_participant_id;
  insert into public.meeting_events(room_id,session_id,actor_user_id,actor_participant_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at)
  values(target_room.id,target_participant.session_id,auth.uid(),target_participant.id,'participant_role_changed','backend','meeting-role-'||target_participant.id::text||'-'||txid_current()::text,0,jsonb_build_object('participantId',target_participant.id,'from',previous_role,'to',next_role),now());
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason,meeting_room_id,meeting_session_id)
  values(target_room.community_id,auth.uid(),'role_change','meeting_participant',target_participant.id,left(btrim(change_reason),300),target_room.id,target_participant.session_id);
  return jsonb_build_object('participantId',target_participant.id,'previousRole',previous_role,'role',next_role);
end;
$$;

drop policy if exists meeting_rooms_select_accessible on public.meeting_rooms;
create policy meeting_rooms_select_accessible on public.meeting_rooms for select to authenticated using(public.can_view_meeting_room(id));
drop policy if exists meeting_rooms_insert_creator on public.meeting_rooms;
create policy meeting_rooms_insert_creator on public.meeting_rooms for insert to authenticated with check(created_by=auth.uid() and host_user_id=auth.uid() and public.effective_community_permission(community_id,'createMeeting',null,null));
drop policy if exists meeting_rooms_update_manager on public.meeting_rooms;
create policy meeting_rooms_update_manager on public.meeting_rooms for update to authenticated using(public.effective_community_permission(community_id,'manageMeeting',null,null)) with check(public.effective_community_permission(community_id,'manageMeeting',null,null));
drop policy if exists meeting_rooms_delete_manager on public.meeting_rooms;
create policy meeting_rooms_delete_manager on public.meeting_rooms for delete to authenticated using(status not in ('live','locked') and public.effective_community_permission(community_id,'manageMeeting',null,null));

drop policy if exists meeting_sessions_select_sensitive on public.meeting_sessions;
create policy meeting_sessions_select_sensitive on public.meeting_sessions for select to authenticated using(public.can_view_meeting_sensitive(room_id));
drop policy if exists meeting_sessions_insert_manager on public.meeting_sessions;
create policy meeting_sessions_insert_manager on public.meeting_sessions for insert to authenticated with check(started_by_user_id=auth.uid() and (public.authorize_meeting_action(room_id,'manage')->>'authorized')::boolean);
drop policy if exists meeting_sessions_update_manager on public.meeting_sessions;
create policy meeting_sessions_update_manager on public.meeting_sessions for update to authenticated using((public.authorize_meeting_action(room_id,'manage')->>'authorized')::boolean) with check((public.authorize_meeting_action(room_id,'manage')->>'authorized')::boolean);
drop policy if exists meeting_sessions_delete_manager on public.meeting_sessions;
create policy meeting_sessions_delete_manager on public.meeting_sessions for delete to authenticated using(status in ('ended','failed') and (public.authorize_meeting_action(room_id,'manage')->>'authorized')::boolean);

drop policy if exists meeting_participants_select_sensitive on public.meeting_session_participants;
create policy meeting_participants_select_sensitive on public.meeting_session_participants for select to authenticated using(exists(select 1 from public.meeting_sessions session where session.id=session_id and public.can_view_meeting_sensitive(session.room_id)));
drop policy if exists meeting_participants_insert_self on public.meeting_session_participants;
create policy meeting_participants_insert_self on public.meeting_session_participants for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.meeting_sessions session where session.id=session_id and public.can_join_meeting_room(session.room_id)));
drop policy if exists meeting_participants_update_self_or_manager on public.meeting_session_participants;
create policy meeting_participants_update_self_or_manager on public.meeting_session_participants for update to authenticated using(user_id=auth.uid() or public.can_manage_meeting_participant(id,role)) with check((user_id=auth.uid() and role=public.meeting_role_for_user((select session.room_id from public.meeting_sessions session where session.id=session_id),auth.uid())) or public.can_manage_meeting_participant(id,role));
drop policy if exists meeting_participants_delete_self_or_manager on public.meeting_session_participants;
create policy meeting_participants_delete_self_or_manager on public.meeting_session_participants for delete to authenticated using(user_id=auth.uid() or public.can_manage_meeting_participant(id,role));

drop policy if exists meeting_waiting_select_self_or_manager on public.meeting_waiting_entries;
create policy meeting_waiting_select_self_or_manager on public.meeting_waiting_entries for select to authenticated using(user_id=auth.uid() or (public.authorize_meeting_action(room_id,'admit')->>'authorized')::boolean);
drop policy if exists meeting_waiting_insert_self on public.meeting_waiting_entries;
create policy meeting_waiting_insert_self on public.meeting_waiting_entries for insert to authenticated with check(user_id=auth.uid() and public.meeting_join_disposition(room_id)='waiting');
drop policy if exists meeting_waiting_update_manager on public.meeting_waiting_entries;
create policy meeting_waiting_update_manager on public.meeting_waiting_entries for update to authenticated using((public.authorize_meeting_action(room_id,'admit')->>'authorized')::boolean) with check((public.authorize_meeting_action(room_id,'admit')->>'authorized')::boolean);
drop policy if exists meeting_waiting_delete_self_or_manager on public.meeting_waiting_entries;
create policy meeting_waiting_delete_self_or_manager on public.meeting_waiting_entries for delete to authenticated using((user_id=auth.uid() and status='waiting') or (public.authorize_meeting_action(room_id,'admit')->>'authorized')::boolean);

drop policy if exists meeting_invites_select_target_or_manager on public.meeting_invites;
create policy meeting_invites_select_target_or_manager on public.meeting_invites for select to authenticated using(invited_user_id=auth.uid() or (public.authorize_meeting_action(room_id,'manage')->>'authorized')::boolean);
drop policy if exists meeting_invites_insert_manager on public.meeting_invites;
create policy meeting_invites_insert_manager on public.meeting_invites for insert to authenticated with check(invited_by_user_id=auth.uid() and (public.authorize_meeting_action(room_id,'manage')->>'authorized')::boolean);
drop policy if exists meeting_invites_update_manager on public.meeting_invites;
create policy meeting_invites_update_manager on public.meeting_invites for update to authenticated using((public.authorize_meeting_action(room_id,'manage')->>'authorized')::boolean) with check((public.authorize_meeting_action(room_id,'manage')->>'authorized')::boolean);
drop policy if exists meeting_invites_delete_manager on public.meeting_invites;
create policy meeting_invites_delete_manager on public.meeting_invites for delete to authenticated using((public.authorize_meeting_action(room_id,'manage')->>'authorized')::boolean);

drop policy if exists meeting_events_select_sensitive on public.meeting_events;
create policy meeting_events_select_sensitive on public.meeting_events for select to authenticated using(public.can_view_meeting_sensitive(room_id));
drop policy if exists meeting_events_insert_client_signal on public.meeting_events;
create policy meeting_events_insert_client_signal on public.meeting_events for insert to authenticated with check(actor_user_id=auth.uid() and event_source='client' and event_type in ('reaction','raised_hand_changed','connection_changed') and public.can_join_meeting_room(room_id));

drop policy if exists meeting_attendance_select_self_or_history_manager on public.meeting_attendance;
create policy meeting_attendance_select_self_or_history_manager on public.meeting_attendance for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.meeting_sessions session join public.meeting_rooms room on room.id=session.room_id where session.id=session_id and public.effective_community_permission(room.community_id,'viewMeetingHistory',null,null)));

grant select,insert,update,delete on public.meeting_rooms,public.meeting_sessions,public.meeting_session_participants,public.meeting_waiting_entries,public.meeting_invites to authenticated;
grant select,insert on public.meeting_events to authenticated;
grant select on public.meeting_attendance to authenticated;
revoke all on public.meeting_rooms,public.meeting_sessions,public.meeting_session_participants,public.meeting_waiting_entries,public.meeting_invites,public.meeting_events,public.meeting_attendance from anon;

revoke all on function public.meeting_role_rank(text),public.meeting_role_for_user(uuid,uuid),public.meeting_user_is_restricted(uuid,uuid),public.can_view_meeting_room(uuid),public.can_join_meeting_room(uuid),public.meeting_join_disposition(uuid),public.can_view_meeting_sensitive(uuid),public.can_manage_meeting_participant(uuid,text),public.authorize_meeting_action(uuid,text),public.set_meeting_participant_role(uuid,text,text) from public,anon;
grant execute on function public.can_view_meeting_room(uuid),public.can_join_meeting_room(uuid),public.meeting_join_disposition(uuid),public.can_view_meeting_sensitive(uuid),public.authorize_meeting_action(uuid,text),public.set_meeting_participant_role(uuid,text,text) to authenticated;

comment on function public.authorize_meeting_action(uuid,text) is 'Authoritative JWT-scoped meeting capability decision; frontend capability checks are UX only.';
comment on function public.set_meeting_participant_role(uuid,text,text) is 'Hierarchy-safe stage role mutation. Self-escalation and host assignment are forbidden.';
commit;
