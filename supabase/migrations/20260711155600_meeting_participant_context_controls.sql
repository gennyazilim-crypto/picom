begin;
create or replace function public.authorize_livekit_meeting_moderation(
  target_room_id uuid,
  target_session_id uuid,
  target_participant_id uuid,
  target_action text
) returns table(provider_room_name text,participant_identity text,action text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  target_session public.meeting_sessions%rowtype;
  target_participant public.meeting_session_participants%rowtype;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  if target_action not in ('mute','remove','deny_screen_share') then raise exception 'MEETING_MODERATION_ACTION_INVALID' using errcode='22023'; end if;
  select * into target_session from public.meeting_sessions where id=target_session_id and room_id=target_room_id;
  select * into target_participant from public.meeting_session_participants where id=target_participant_id and session_id=target_session_id;
  if target_session.id is null or target_participant.id is null or target_participant.state not in ('joining','connected','reconnecting') then raise exception 'MEETING_PARTICIPANT_NOT_ACTIVE' using errcode='22023'; end if;
  if target_participant.user_id=auth.uid() or not public.can_manage_meeting_participant(target_participant.id,target_participant.role) then raise exception 'MEETING_MODERATION_FORBIDDEN' using errcode='42501'; end if;
  return query select target_session.provider_room_name,target_participant.provider_identity,target_action;
end;
$$;
create or replace function public.record_livekit_meeting_moderation(
  target_room_id uuid,
  target_session_id uuid,
  target_participant_id uuid,
  target_action text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  audit_id uuid;
  target_community_id uuid;
begin
  perform 1 from public.authorize_livekit_meeting_moderation(target_room_id,target_session_id,target_participant_id,target_action);
  select community_id into target_community_id from public.meeting_rooms where id=target_room_id;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason)
  values(target_community_id,auth.uid(),'moderation_action','meeting_participant',target_participant_id,left('meeting_'||target_action||':'||target_session_id::text,500))
  returning id into audit_id;
  return audit_id;
end;
$$;
revoke all on function public.authorize_livekit_meeting_moderation(uuid,uuid,uuid,text),public.record_livekit_meeting_moderation(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.authorize_livekit_meeting_moderation(uuid,uuid,uuid,text),public.record_livekit_meeting_moderation(uuid,uuid,uuid,text) to authenticated;
comment on function public.authorize_livekit_meeting_moderation(uuid,uuid,uuid,text) is 'Resolves provider room and identity only after JWT, active session, hierarchy, and meeting participant authorization.';
commit;
