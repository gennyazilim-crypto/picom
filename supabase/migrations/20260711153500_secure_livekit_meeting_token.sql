-- Task 535: server-authoritative, least-privilege LiveKit meeting token authorization.
begin;
create or replace function public.meeting_livekit_room_name(target_room_id uuid,target_session_id uuid)
returns text language sql immutable strict set search_path=public,pg_temp as $$
  select 'meeting:'||target_room_id::text||':session:'||target_session_id::text;
$$;
create or replace function public.meeting_capability_enabled(target_capabilities jsonb,target_key text,default_value boolean)
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select case when jsonb_typeof(coalesce(target_capabilities,'{}'::jsonb)->target_key)='boolean'
    then (target_capabilities->>target_key)::boolean else default_value end;
$$;
create or replace function public.authorize_livekit_meeting_token(
  target_room_id uuid,
  target_session_id uuid,
  request_audio boolean default false,
  request_video boolean default false,
  request_screen boolean default false,
  request_data boolean default false
) returns table(
  room_id uuid,
  session_id uuid,
  community_id uuid,
  provider_room_name text,
  participant_identity text,
  participant_name text,
  meeting_role text,
  access_state text,
  waiting_entry_id uuid,
  can_subscribe boolean,
  can_publish_audio boolean,
  can_publish_video boolean,
  can_publish_screen boolean,
  can_publish_data boolean
) language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare
  room_record public.meeting_rooms%rowtype;
  session_record public.meeting_sessions%rowtype;
  profile_record public.profiles%rowtype;
  waiting_record public.meeting_waiting_entries%rowtype;
  resolved_role text;
  canonical_room_name text;
  manager_access boolean:=false;
  member_access boolean:=false;
  invite_access boolean:=false;
  allowed_audio boolean:=false;
  allowed_video boolean:=false;
  allowed_screen boolean:=false;
  allowed_data boolean:=false;
  active_count integer:=0;
  waiting_required boolean:=false;
  event_key text;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  perform public.consume_meeting_request_limit('livekit_token');
  select * into room_record from public.meeting_rooms where id=target_room_id and archived_at is null;
  if room_record.id is null or room_record.status not in ('open','live') then raise exception 'MEETING_ROOM_NOT_OPEN' using errcode='42501'; end if;
  select * into session_record from public.meeting_sessions where id=target_session_id and room_id=target_room_id and status in ('preparing','live','reconnecting') for update;
  if session_record.id is null then raise exception 'MEETING_SESSION_UNAVAILABLE' using errcode='42501'; end if;
  if public.meeting_user_is_restricted(target_room_id,auth.uid()) or not public.can_join_meeting_room(target_room_id) then raise exception 'MEETING_JOIN_FORBIDDEN' using errcode='42501'; end if;
  select * into profile_record from public.profiles where id=auth.uid();
  if profile_record.id is null then raise exception 'MEETING_PROFILE_REQUIRED' using errcode='42501'; end if;
  select count(*) into active_count from public.meeting_session_participants participant where participant.session_id=target_session_id and participant.state in ('joining','connected','reconnecting') and participant.user_id<>auth.uid();
  if active_count>=room_record.max_participants then raise exception 'MEETING_CAPACITY_REACHED' using errcode='42501'; end if;

  resolved_role:=public.meeting_role_for_user(target_room_id,auth.uid());
  member_access:=public.is_community_member(room_record.community_id);
  select exists(select 1 from public.meeting_invites invite where invite.room_id=target_room_id and public.meeting_invite_grants_user(invite.id,auth.uid())) into invite_access;
  manager_access:=resolved_role in ('host','cohost') or (member_access and public.effective_community_permission(room_record.community_id,'manageMeeting',null,null));
  waiting_required:=(room_record.waiting_room_enabled or room_record.join_policy='approval_required') and not manager_access;

  canonical_room_name:=public.meeting_livekit_room_name(target_room_id,target_session_id);
  if session_record.provider_room_name<>canonical_room_name then
    if session_record.status<>'preparing' then raise exception 'MEETING_ROOM_NAME_MISMATCH' using errcode='55000'; end if;
    update public.meeting_sessions set provider_room_name=canonical_room_name,updated_at=now() where id=session_record.id returning * into session_record;
  end if;

  if waiting_required then
    select * into waiting_record from public.meeting_waiting_entries entry
    where entry.room_id=target_room_id and entry.user_id=auth.uid() and (entry.session_id=target_session_id or entry.session_id is null)
      and entry.status in ('waiting','admitted','denied','expired','cancelled')
    order by case entry.status when 'admitted' then 0 when 'waiting' then 1 else 2 end,entry.requested_at desc limit 1 for update;
    if waiting_record.id is not null and waiting_record.status='admitted' then null;
    elsif waiting_record.id is not null and waiting_record.status='waiting' then
      return query select room_record.id,session_record.id,room_record.community_id,canonical_room_name,auth.uid()::text,coalesce(nullif(profile_record.display_name,''),profile_record.username,'Picom user'),resolved_role,'waiting',waiting_record.id,true,false,false,false,false;
      return;
    elsif waiting_record.id is not null then raise exception 'MEETING_WAITING_DENIED' using errcode='42501';
    else
      insert into public.meeting_waiting_entries(room_id,session_id,user_id,display_name,requested_role,status,idempotency_key,requested_at)
      values(target_room_id,target_session_id,auth.uid(),coalesce(nullif(profile_record.display_name,''),profile_record.username,'Picom user'),resolved_role,'waiting','meeting-token:'||target_session_id::text||':'||auth.uid()::text,now())
      on conflict(room_id,idempotency_key) do update set session_id=excluded.session_id,display_name=excluded.display_name,requested_role=excluded.requested_role,updated_at=now()
      returning * into waiting_record;
      insert into public.meeting_events(room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at)
      values(target_room_id,target_session_id,auth.uid(),'waiting_room_changed','backend','waiting-request:'||waiting_record.id::text,0,jsonb_build_object('entryId',waiting_record.id,'status','waiting'),now())
      on conflict(event_source,idempotency_key) do nothing;
      return query select room_record.id,session_record.id,room_record.community_id,canonical_room_name,auth.uid()::text,coalesce(nullif(profile_record.display_name,''),profile_record.username,'Picom user'),resolved_role,'waiting',waiting_record.id,true,false,false,false,false;
      return;
    end if;
  end if;

  allowed_audio:=public.meeting_capability_enabled(room_record.capabilities,'canPublishAudio',true)
    and resolved_role in ('host','cohost','speaker','participant')
    and (manager_access or invite_access or (member_access and public.effective_community_permission(room_record.community_id,'publishAudio','channel',room_record.channel_id)));
  allowed_video:=room_record.mode<>'voice' and public.meeting_capability_enabled(room_record.capabilities,'canPublishVideo',room_record.mode<>'voice')
    and resolved_role in ('host','cohost','speaker','participant')
    and (manager_access or invite_access or (member_access and public.effective_community_permission(room_record.community_id,'publishVideo','channel',room_record.channel_id)));
  allowed_screen:=public.meeting_capability_enabled(room_record.capabilities,'canShareScreen',true)
    and resolved_role in ('host','cohost','speaker')
    and (manager_access or invite_access or (member_access and public.effective_community_permission(room_record.community_id,'shareScreen','channel',room_record.channel_id)));
  allowed_data:=(public.meeting_capability_enabled(room_record.capabilities,'canSendChat',true) or public.meeting_capability_enabled(room_record.capabilities,'canReact',true) or public.meeting_capability_enabled(room_record.capabilities,'canRaiseHand',true))
    and (manager_access or invite_access or member_access);

  if (request_audio and not allowed_audio) or (request_video and not allowed_video) or (request_screen and not allowed_screen) or (request_data and not allowed_data) then raise exception 'MEETING_SOURCE_FORBIDDEN' using errcode='42501'; end if;

  insert into public.meeting_session_participants(session_id,user_id,provider_identity,display_name,role,state,capabilities,last_seen_at,updated_at)
  values(target_session_id,auth.uid(),auth.uid()::text,coalesce(nullif(profile_record.display_name,''),profile_record.username,'Picom user'),resolved_role,'joining',jsonb_build_object('canSubscribe',true,'canPublishAudio',request_audio and allowed_audio,'canPublishVideo',request_video and allowed_video,'canShareScreen',request_screen and allowed_screen,'canPublishData',request_data and allowed_data),now(),now())
  on conflict(session_id,provider_identity) do update set user_id=excluded.user_id,display_name=excluded.display_name,role=excluded.role,state=case when meeting_session_participants.state='connected' then 'connected' else 'joining' end,capabilities=excluded.capabilities,last_seen_at=now(),updated_at=now();

  event_key:='token-authorized:'||target_session_id::text||':'||auth.uid()::text||':'||floor(extract(epoch from now())/60)::bigint::text;
  insert into public.meeting_events(room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at)
  values(target_room_id,target_session_id,auth.uid(),'token_authorized','backend',event_key,0,jsonb_build_object('role',resolved_role,'audio',request_audio,'video',request_video,'screen',request_screen,'data',request_data),now())
  on conflict(event_source,idempotency_key) do nothing;

  return query select room_record.id,session_record.id,room_record.community_id,canonical_room_name,auth.uid()::text,coalesce(nullif(profile_record.display_name,''),profile_record.username,'Picom user'),resolved_role,'authorized',null::uuid,true,request_audio and allowed_audio,request_video and allowed_video,request_screen and allowed_screen,request_data and allowed_data;
end;
$$;
revoke all on function public.meeting_livekit_room_name(uuid,uuid),public.meeting_capability_enabled(jsonb,text,boolean) from public,anon,authenticated;
revoke all on function public.authorize_livekit_meeting_token(uuid,uuid,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.authorize_livekit_meeting_token(uuid,uuid,boolean,boolean,boolean,boolean) to authenticated;
comment on function public.authorize_livekit_meeting_token(uuid,uuid,boolean,boolean,boolean,boolean) is 'Server-authoritative meeting token projection. Waiting users receive no publish grant; bans, blocks, capacity, role, room capabilities, and requested sources fail closed.';
commit;
