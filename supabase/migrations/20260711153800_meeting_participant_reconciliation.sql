-- Task 538: canonical meeting participant state and presence reconciliation.
-- Supabase owns identity/roles/attendance, LiveKit owns transient media state,
-- and the renderer merges those sources without allowing client role drift.

alter table public.meeting_session_participants
  add column if not exists provider_joined_at timestamptz,
  add column if not exists provider_left_at timestamptz,
  add column if not exists last_provider_event_at timestamptz,
  add column if not exists last_provider_event_id text,
  add column if not exists last_provider_event_type text,
  add column if not exists connection_generation integer not null default 0;
alter table public.meeting_participant_tracks
  add column if not exists last_provider_event_at timestamptz,
  add column if not exists last_provider_event_id text;
do $$ begin
  alter table public.meeting_session_participants add constraint meeting_participant_provider_event_id_safe
    check (last_provider_event_id is null or last_provider_event_id ~ '^[0-9a-fA-F-]{36}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.meeting_session_participants add constraint meeting_participant_provider_event_type_safe
    check (last_provider_event_type is null or last_provider_event_type in ('participant_joined','participant_left','participant_connection_aborted','room_finished','cleanup'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.meeting_session_participants add constraint meeting_participant_connection_generation_safe
    check (connection_generation between 0 and 1000000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.meeting_participant_tracks add constraint meeting_track_provider_event_id_safe
    check (last_provider_event_id is null or last_provider_event_id ~ '^[0-9a-fA-F-]{36}$');
exception when duplicate_object then null; end $$;
create table if not exists public.meeting_participant_runtime_state (
  participant_id uuid primary key references public.meeting_session_participants(id) on delete cascade,
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  hand_raised boolean not null default false,
  hand_raised_at timestamptz,
  hand_sequence bigint not null default 0 check (hand_sequence between 0 and 1000000000),
  server_version bigint not null default 0 check (server_version between 0 and 1000000000),
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((hand_raised and hand_raised_at is not null) or (not hand_raised and hand_raised_at is null))
);
create index if not exists idx_meeting_participants_session_state_provider_time
  on public.meeting_session_participants(session_id,state,last_provider_event_at desc);
create index if not exists idx_meeting_participant_runtime_session_hand
  on public.meeting_participant_runtime_state(session_id,hand_raised,hand_sequence);
alter table public.meeting_participant_runtime_state enable row level security;
alter table public.meeting_session_participants replica identity full;
alter table public.meeting_participant_tracks replica identity full;
alter table public.meeting_participant_runtime_state replica identity full;
revoke all on table public.meeting_participant_runtime_state from public,anon,authenticated;
grant select on table public.meeting_participant_runtime_state to authenticated;
-- Participant lifecycle is provider/server authoritative after this migration.
revoke insert,update,delete on table public.meeting_session_participants from authenticated;
grant select on table public.meeting_session_participants to authenticated;
drop policy if exists meeting_participant_runtime_visible_select on public.meeting_participant_runtime_state;
create policy meeting_participant_runtime_visible_select on public.meeting_participant_runtime_state
for select to authenticated using (
  exists (
    select 1 from public.meeting_sessions session
    where session.id=meeting_participant_runtime_state.session_id
      and public.can_view_meeting_sensitive(session.room_id)
  )
);
create or replace function public.livekit_participant_event_rank(target_event_type text)
returns integer language sql immutable parallel safe as $$
  select case target_event_type
    when 'participant_connection_aborted' then 30
    when 'participant_left' then 30
    when 'participant_joined' then 20
    else 10
  end
$$;
revoke all on function public.livekit_participant_event_rank(text) from public,anon,authenticated;
create or replace function public.process_livekit_webhook_event(
  target_event_id text,
  target_event_type text,
  target_occurred_at timestamptz,
  target_room_id uuid,
  target_session_id uuid,
  target_room_name text,
  target_payload_digest text,
  target_participant_identity text default null,
  target_participant_name text default null,
  target_track_sid text default null,
  target_track_kind text default null,
  target_track_source text default null
) returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare
  receipt_record public.livekit_webhook_receipts%rowtype;
  room_record public.meeting_rooms%rowtype;
  session_record public.meeting_sessions%rowtype;
  participant_record public.meeting_session_participants%rowtype;
  existing_participant public.meeting_session_participants%rowtype;
  participant_user_id uuid;
  participant_role text:='guest';
  participant_display_name text;
  identity_hash text;
  next_sequence bigint;
  safe_payload jsonb:='{}'::jsonb;
  final_attendance_state text:='left';
  failure_state text;
  affected_count integer:=0;
  stale_event boolean:=false;
begin
  if coalesce(auth.role(),current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'LIVEKIT_WEBHOOK_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if target_event_id is null or target_event_id!~'^[0-9a-fA-F-]{36}$' or target_event_type not in ('room_started','room_finished','participant_joined','participant_left','participant_connection_aborted','track_published','track_unpublished') then raise exception 'LIVEKIT_WEBHOOK_EVENT_INVALID' using errcode='22023'; end if;
  if target_payload_digest is null or target_payload_digest!~'^[0-9a-f]{64}$' then raise exception 'LIVEKIT_WEBHOOK_DIGEST_INVALID' using errcode='22023'; end if;
  if target_occurred_at>now()+interval '5 minutes' or target_occurred_at<now()-interval '7 days' then raise exception 'LIVEKIT_WEBHOOK_TIME_INVALID' using errcode='22023'; end if;
  select * into room_record from public.meeting_rooms where id=target_room_id and archived_at is null;
  select * into session_record from public.meeting_sessions where id=target_session_id and room_id=target_room_id for update;
  if room_record.id is null or session_record.id is null or target_room_name<>public.meeting_livekit_room_name(target_room_id,target_session_id) or session_record.provider_room_name<>target_room_name then raise exception 'LIVEKIT_WEBHOOK_ROOM_INVALID' using errcode='22023'; end if;

  insert into public.livekit_webhook_receipts(event_id,event_type,room_name,payload_digest,status,attempt_count,first_received_at,last_received_at)
  values(lower(target_event_id),target_event_type,target_room_name,target_payload_digest,'processing',0,now(),now()) on conflict(event_id) do nothing;
  select * into receipt_record from public.livekit_webhook_receipts where event_id=lower(target_event_id) for update;
  if receipt_record.payload_digest<>target_payload_digest then return jsonb_build_object('processed',false,'duplicate',false,'errorCode','WEBHOOK_REPLAY_MISMATCH'); end if;
  if receipt_record.status='processed' then
    update public.livekit_webhook_receipts set attempt_count=attempt_count+1,last_received_at=now() where event_id=receipt_record.event_id;
    return jsonb_build_object('processed',true,'duplicate',true,'eventId',receipt_record.event_id,'eventType',receipt_record.event_type);
  end if;
  update public.livekit_webhook_receipts set status='processing',attempt_count=attempt_count+1,error_code=null,last_received_at=now() where event_id=receipt_record.event_id;

  begin
    if target_event_type in ('participant_joined','participant_left','participant_connection_aborted','track_published','track_unpublished') then
      if target_participant_identity is null or char_length(target_participant_identity) not between 1 and 180 then raise exception 'LIVEKIT_PARTICIPANT_INVALID'; end if;
      identity_hash:=encode(digest(target_participant_identity,'sha256'),'hex');
      if target_participant_identity~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and exists(select 1 from public.profiles where id=target_participant_identity::uuid) then participant_user_id:=target_participant_identity::uuid; end if;
      participant_role:=case when participant_user_id is null then 'guest' else public.meeting_role_for_user(target_room_id,participant_user_id) end;
      participant_display_name:=left(coalesce(nullif(btrim(target_participant_name),''),'Picom participant'),120);
      select * into existing_participant from public.meeting_session_participants where session_id=target_session_id and provider_identity=target_participant_identity for update;

      if target_event_type in ('participant_joined','participant_left','participant_connection_aborted') and existing_participant.id is not null and existing_participant.last_provider_event_at is not null then
        stale_event:=target_occurred_at<existing_participant.last_provider_event_at
          or (target_occurred_at=existing_participant.last_provider_event_at
            and public.livekit_participant_event_rank(target_event_type)<public.livekit_participant_event_rank(existing_participant.last_provider_event_type));
      end if;
      if stale_event then
        update public.livekit_webhook_receipts set status='processed',processed_at=now(),error_code=null,last_received_at=now() where event_id=lower(target_event_id);
        return jsonb_build_object('processed',true,'duplicate',false,'stale',true,'eventId',lower(target_event_id),'eventType',target_event_type,'participantId',existing_participant.id,'currentState',existing_participant.state);
      end if;

      if target_event_type='participant_joined' then
        insert into public.meeting_session_participants(session_id,user_id,provider_identity,display_name,role,state,capabilities,joined_at,left_at,last_seen_at,provider_joined_at,provider_left_at,last_provider_event_at,last_provider_event_id,last_provider_event_type,connection_generation,updated_at)
        values(target_session_id,participant_user_id,target_participant_identity,participant_display_name,participant_role,'connected','{}'::jsonb,target_occurred_at,null,target_occurred_at,target_occurred_at,null,target_occurred_at,lower(target_event_id),target_event_type,1,now())
        on conflict(session_id,provider_identity) do update set user_id=coalesce(excluded.user_id,meeting_session_participants.user_id),display_name=excluded.display_name,role=excluded.role,state='connected',joined_at=coalesce(meeting_session_participants.joined_at,excluded.joined_at),left_at=null,last_seen_at=excluded.last_seen_at,provider_joined_at=excluded.provider_joined_at,provider_left_at=null,last_provider_event_at=excluded.last_provider_event_at,last_provider_event_id=excluded.last_provider_event_id,last_provider_event_type=excluded.last_provider_event_type,connection_generation=case when meeting_session_participants.state in ('left','removed') then meeting_session_participants.connection_generation+1 else greatest(meeting_session_participants.connection_generation,1) end,updated_at=now()
        returning * into participant_record;
      else
        insert into public.meeting_session_participants(session_id,user_id,provider_identity,display_name,role,state,capabilities,last_seen_at,updated_at)
        values(target_session_id,participant_user_id,target_participant_identity,participant_display_name,participant_role,'joining','{}'::jsonb,target_occurred_at,now())
        on conflict(session_id,provider_identity) do update set user_id=coalesce(excluded.user_id,meeting_session_participants.user_id),display_name=excluded.display_name,role=excluded.role,last_seen_at=greatest(coalesce(meeting_session_participants.last_seen_at,'epoch'::timestamptz),excluded.last_seen_at),updated_at=now()
        returning * into participant_record;
      end if;
    end if;

    if target_event_type='room_started' then
      update public.meeting_sessions set status='live',connection_state='connected',started_at=coalesce(started_at,target_occurred_at),updated_at=now() where id=target_session_id;
      update public.meeting_rooms set status='live',updated_at=now() where id=target_room_id and status in ('open','scheduled','live');
    elsif target_event_type='room_finished' then
      update public.meeting_sessions set status='ended',connection_state='disconnected',started_at=coalesce(started_at,target_occurred_at),ended_at=coalesce(ended_at,target_occurred_at),participant_count=0,updated_at=now() where id=target_session_id;
      update public.meeting_session_participants set state='left',left_at=coalesce(left_at,target_occurred_at),provider_left_at=coalesce(provider_left_at,target_occurred_at),last_seen_at=greatest(coalesce(last_seen_at,'epoch'::timestamptz),target_occurred_at),last_provider_event_at=greatest(coalesce(last_provider_event_at,'epoch'::timestamptz),target_occurred_at),last_provider_event_id=lower(target_event_id),last_provider_event_type='room_finished',updated_at=now() where session_id=target_session_id and state in ('invited','waiting','joining','connected','reconnecting');
      update public.meeting_participant_tracks set state='unpublished',unpublished_at=coalesce(unpublished_at,target_occurred_at),last_provider_event_at=greatest(coalesce(last_provider_event_at,'epoch'::timestamptz),target_occurred_at),last_provider_event_id=lower(target_event_id),updated_at=now() where session_id=target_session_id and state='published';
      update public.meeting_attendance set left_at=coalesce(left_at,target_occurred_at),duration_seconds=greatest(0,extract(epoch from (coalesce(left_at,target_occurred_at)-joined_at))::integer),final_state='ended',updated_at=now() where session_id=target_session_id and left_at is null;
      update public.meeting_rooms set status='ended',ended_at=coalesce(ended_at,target_occurred_at),updated_at=now() where id=target_room_id and status not in ('cancelled','ended');
    elsif target_event_type='participant_joined' then
      insert into public.meeting_attendance(session_id,user_id,participant_identity_hash,role,joined_at,left_at,duration_seconds,reconnect_count,final_state,updated_at)
      values(target_session_id,participant_user_id,identity_hash,participant_role,target_occurred_at,null,null,0,'left',now())
      on conflict(session_id,participant_identity_hash) do update set user_id=coalesce(excluded.user_id,meeting_attendance.user_id),role=excluded.role,joined_at=case when meeting_attendance.left_at is not null then excluded.joined_at else meeting_attendance.joined_at end,left_at=null,duration_seconds=null,reconnect_count=case when meeting_attendance.left_at is not null then meeting_attendance.reconnect_count+1 else meeting_attendance.reconnect_count end,updated_at=now();
      update public.meeting_sessions set participant_count=(select count(*) from public.meeting_session_participants where session_id=target_session_id and state in ('joining','connected','reconnecting')),updated_at=now() where id=target_session_id;
    elsif target_event_type in ('participant_left','participant_connection_aborted') then
      final_attendance_state:=case when target_event_type='participant_connection_aborted' then 'disconnected' else 'left' end;
      update public.meeting_session_participants set state='left',left_at=target_occurred_at,provider_left_at=target_occurred_at,last_seen_at=target_occurred_at,last_provider_event_at=target_occurred_at,last_provider_event_id=lower(target_event_id),last_provider_event_type=target_event_type,updated_at=now() where id=participant_record.id returning * into participant_record;
      update public.meeting_participant_runtime_state set hand_raised=false,hand_raised_at=null,server_version=server_version+1,updated_at=now() where participant_id=participant_record.id;
      update public.meeting_attendance set user_id=coalesce(user_id,participant_user_id),role=participant_role,left_at=target_occurred_at,duration_seconds=greatest(0,extract(epoch from (target_occurred_at-joined_at))::integer),final_state=final_attendance_state,updated_at=now() where session_id=target_session_id and participant_identity_hash=identity_hash;
      update public.meeting_sessions set participant_count=(select count(*) from public.meeting_session_participants where session_id=target_session_id and state in ('joining','connected','reconnecting')),updated_at=now() where id=target_session_id;
    elsif target_event_type in ('track_published','track_unpublished') then
      if target_track_sid is null or char_length(target_track_sid) not between 1 and 180 or target_track_kind not in ('audio','video') or target_track_source not in ('microphone','camera','screen_share','screen_share_audio','unknown') then raise exception 'LIVEKIT_TRACK_INVALID'; end if;
      insert into public.meeting_participant_tracks(session_id,participant_id,provider_track_sid,kind,source,state,published_at,unpublished_at,last_provider_event_at,last_provider_event_id,updated_at)
      values(target_session_id,participant_record.id,target_track_sid,target_track_kind,target_track_source,case when target_event_type='track_published' then 'published' else 'unpublished' end,target_occurred_at,case when target_event_type='track_unpublished' then target_occurred_at else null end,target_occurred_at,lower(target_event_id),now())
      on conflict(session_id,provider_track_sid) do update set participant_id=excluded.participant_id,kind=excluded.kind,source=excluded.source,state=excluded.state,published_at=case when excluded.state='published' then excluded.published_at else meeting_participant_tracks.published_at end,unpublished_at=excluded.unpublished_at,last_provider_event_at=excluded.last_provider_event_at,last_provider_event_id=excluded.last_provider_event_id,updated_at=now()
      where meeting_participant_tracks.last_provider_event_at is null or excluded.last_provider_event_at>meeting_participant_tracks.last_provider_event_at or (excluded.last_provider_event_at=meeting_participant_tracks.last_provider_event_at and excluded.state='unpublished' and meeting_participant_tracks.state='published');
      get diagnostics affected_count=row_count;
      if affected_count=0 then
        update public.livekit_webhook_receipts set status='processed',processed_at=now(),error_code=null,last_received_at=now() where event_id=lower(target_event_id);
        return jsonb_build_object('processed',true,'duplicate',false,'stale',true,'eventId',lower(target_event_id),'eventType',target_event_type,'participantId',participant_record.id);
      end if;
    end if;

    update public.meeting_sessions set last_event_sequence=last_event_sequence+1,updated_at=now() where id=target_session_id returning last_event_sequence into next_sequence;
    safe_payload:=jsonb_strip_nulls(jsonb_build_object('participantIdentityHash',identity_hash,'participantGeneration',participant_record.connection_generation,'trackSid',target_track_sid,'trackKind',target_track_kind,'trackSource',target_track_source,'state',case when target_event_type in ('participant_left','participant_connection_aborted','track_unpublished','room_finished') then 'ended' else 'active' end));
    insert into public.meeting_events(room_id,session_id,actor_user_id,actor_participant_id,event_type,event_source,provider_event_id,idempotency_key,sequence,payload,occurred_at)
    values(target_room_id,target_session_id,participant_user_id,participant_record.id,target_event_type,'livekit',lower(target_event_id),lower(target_event_id),next_sequence,safe_payload,target_occurred_at)
    on conflict(event_source,idempotency_key) do nothing;
    update public.livekit_webhook_receipts set status='processed',processed_at=now(),error_code=null,last_received_at=now() where event_id=lower(target_event_id);
    return jsonb_build_object('processed',true,'duplicate',false,'stale',false,'eventId',lower(target_event_id),'eventType',target_event_type,'sessionId',target_session_id,'sequence',next_sequence);
  exception when others then
    get stacked diagnostics failure_state=returned_sqlstate;
    update public.livekit_webhook_receipts set status='failed',error_code=left('PROCESSING_'||coalesce(failure_state,'UNKNOWN'),80),last_received_at=now() where event_id=lower(target_event_id);
    return jsonb_build_object('processed',false,'duplicate',false,'eventId',lower(target_event_id),'eventType',target_event_type,'errorCode',left('PROCESSING_'||coalesce(failure_state,'UNKNOWN'),80));
  end;
end;
$$;
revoke all on function public.process_livekit_webhook_event(text,text,timestamptz,uuid,uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.process_livekit_webhook_event(text,text,timestamptz,uuid,uuid,text,text,text,text,text,text,text) to service_role;
create or replace function public.set_meeting_participant_hand_state(target_participant_id uuid,target_raised boolean)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare participant_record public.meeting_session_participants%rowtype; next_hand_sequence bigint; result_record public.meeting_participant_runtime_state%rowtype;
begin
  if auth.uid() is null then raise exception 'MEETING_AUTH_REQUIRED' using errcode='42501'; end if;
  select * into participant_record from public.meeting_session_participants where id=target_participant_id for update;
  if participant_record.id is null or participant_record.state not in ('joining','connected','reconnecting') then raise exception 'MEETING_PARTICIPANT_NOT_ACTIVE' using errcode='22023'; end if;
  if participant_record.user_id<>auth.uid() and not public.can_manage_meeting_participant(participant_record.id,participant_record.role) then raise exception 'MEETING_PARTICIPANT_HAND_FORBIDDEN' using errcode='42501'; end if;
  select coalesce(max(runtime.hand_sequence),0)+1 into next_hand_sequence from public.meeting_participant_runtime_state runtime where runtime.session_id=participant_record.session_id;
  insert into public.meeting_participant_runtime_state(participant_id,session_id,hand_raised,hand_raised_at,hand_sequence,server_version,updated_by_user_id,updated_at)
  values(participant_record.id,participant_record.session_id,target_raised,case when target_raised then now() else null end,case when target_raised then next_hand_sequence else 0 end,1,auth.uid(),now())
  on conflict(participant_id) do update set hand_raised=excluded.hand_raised,hand_raised_at=excluded.hand_raised_at,hand_sequence=excluded.hand_sequence,server_version=meeting_participant_runtime_state.server_version+1,updated_by_user_id=auth.uid(),updated_at=now()
  returning * into result_record;
  return jsonb_build_object('participantId',result_record.participant_id,'sessionId',result_record.session_id,'handRaised',result_record.hand_raised,'handRaisedAt',result_record.hand_raised_at,'handSequence',result_record.hand_sequence,'serverVersion',result_record.server_version,'updatedAt',result_record.updated_at);
end;
$$;
revoke all on function public.set_meeting_participant_hand_state(uuid,boolean) from public,anon;
grant execute on function public.set_meeting_participant_hand_state(uuid,boolean) to authenticated;
create or replace function public.get_meeting_participant_snapshot(target_room_id uuid,target_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare session_record public.meeting_sessions%rowtype; room_record public.meeting_rooms%rowtype; participants_json jsonb;
begin
  if auth.uid() is null or not public.can_view_meeting_sensitive(target_room_id) then raise exception 'MEETING_PARTICIPANTS_FORBIDDEN' using errcode='42501'; end if;
  select * into room_record from public.meeting_rooms where id=target_room_id and archived_at is null;
  select * into session_record from public.meeting_sessions where id=target_session_id and room_id=target_room_id;
  if room_record.id is null or session_record.id is null then raise exception 'MEETING_SESSION_NOT_FOUND' using errcode='22023'; end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'participantId',participant.id,'sessionId',participant.session_id,'userId',participant.user_id,'providerIdentity',participant.provider_identity,
    'displayName',participant.display_name,'username',profile.username,'avatarUrl',profile.avatar_url,
    'meetingRole',participant.role,'communityRole',case when community_role.id is null then null else jsonb_build_object('id',community_role.id,'name',community_role.name) end,
    'verification',case when verification.type is null then jsonb_build_object('status','none') else jsonb_build_object('status','approved','type',verification.type,'approvedAt',verification.reviewed_at) end,
    'clientPresence',jsonb_build_object('status',case when participant.user_id=auth.uid() or friend_presence.share_presence then coalesce(friend_presence.status,'offline') else 'unknown' end,'shared',coalesce(friend_presence.share_presence,false)),
    'providerPresence',participant.state,'capabilities',participant.capabilities,'connectionGeneration',participant.connection_generation,
    'joinedAt',participant.joined_at,'leftAt',participant.left_at,'lastSeenAt',participant.last_seen_at,
    'lastProviderEventAt',participant.last_provider_event_at,'lastProviderEventId',participant.last_provider_event_id,
    'handState',jsonb_build_object('raised',coalesce(runtime.hand_raised,false),'raisedAt',runtime.hand_raised_at,'sequence',coalesce(runtime.hand_sequence,0),'serverVersion',coalesce(runtime.server_version,0)),
    'attendance',case when attendance.id is null then null else jsonb_build_object('joinedAt',attendance.joined_at,'leftAt',attendance.left_at,'durationSeconds',attendance.duration_seconds,'reconnectCount',attendance.reconnect_count,'finalState',attendance.final_state) end,
    'tracks',coalesce(tracks.items,'[]'::jsonb)
  )) order by case when participant.state in ('joining','connected','reconnecting') then 0 else 1 end,coalesce(participant.joined_at,participant.created_at),participant.id),'[]'::jsonb)
  into participants_json
  from public.meeting_session_participants participant
  left join public.profiles profile on profile.id=participant.user_id
  left join public.community_members membership on membership.community_id=room_record.community_id and membership.user_id=participant.user_id
  left join public.roles community_role on community_role.id=membership.role_id
  left join public.friend_presence on friend_presence.user_id=participant.user_id
  left join public.meeting_participant_runtime_state runtime on runtime.participant_id=participant.id
  left join lateral (
    select case when verification_row.type='creator_verified' then 'verified_user' else verification_row.type end as type,verification_row.reviewed_at
    from public.profile_verifications verification_row
    where verification_row.user_id=participant.user_id and verification_row.status='approved' and verification_row.revoked_at is null
    order by case verification_row.type when 'picom_staff' then 1 when 'verified_bot' then 2 else 3 end,verification_row.reviewed_at desc nulls last limit 1
  ) verification on true
  left join lateral (
    select attendance_row.* from public.meeting_attendance attendance_row
    where attendance_row.session_id=participant.session_id and attendance_row.participant_identity_hash=encode(digest(participant.provider_identity,'sha256'),'hex')
    order by attendance_row.joined_at desc limit 1
  ) attendance on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id',track.id,'providerTrackSid',track.provider_track_sid,'kind',track.kind,'source',track.source,'state',track.state,'publishedAt',track.published_at,'unpublishedAt',track.unpublished_at,'lastProviderEventAt',track.last_provider_event_at) order by track.published_at,track.id) as items
    from public.meeting_participant_tracks track where track.participant_id=participant.id
  ) tracks on true
  where participant.session_id=target_session_id;

  return jsonb_build_object('schemaVersion',1,'roomId',target_room_id,'sessionId',target_session_id,'sessionSequence',session_record.last_event_sequence,'generatedAt',now(),'participants',participants_json);
end;
$$;
revoke all on function public.get_meeting_participant_snapshot(uuid,uuid) from public,anon;
grant execute on function public.get_meeting_participant_snapshot(uuid,uuid) to authenticated;
create or replace function public.cleanup_stale_meeting_participants(target_session_id uuid,target_stale_before timestamptz default now()-interval '90 seconds')
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare session_record public.meeting_sessions%rowtype; stale_ids uuid[]:='{}'::uuid[]; affected_count integer:=0; next_sequence bigint;
begin
  select * into session_record from public.meeting_sessions where id=target_session_id for update;
  if session_record.id is null then raise exception 'MEETING_SESSION_NOT_FOUND' using errcode='22023'; end if;
  if coalesce(auth.role(),current_setting('request.jwt.claim.role',true),'')<>'service_role' and (auth.uid() is null or not public.can_manage_meeting_waiting(session_record.room_id)) then raise exception 'MEETING_PARTICIPANT_CLEANUP_FORBIDDEN' using errcode='42501'; end if;
  if target_stale_before>now()-interval '30 seconds' or target_stale_before<now()-interval '24 hours' then raise exception 'MEETING_PARTICIPANT_CLEANUP_WINDOW_INVALID' using errcode='22023'; end if;

  with stale as (
    update public.meeting_session_participants participant set state='left',left_at=coalesce(participant.left_at,participant.last_seen_at,now()),provider_left_at=coalesce(participant.provider_left_at,participant.last_seen_at,now()),last_provider_event_at=greatest(coalesce(participant.last_provider_event_at,'epoch'::timestamptz),coalesce(participant.last_seen_at,'epoch'::timestamptz)),last_provider_event_type='cleanup',updated_at=now()
    where participant.session_id=target_session_id and participant.state in ('joining','connected','reconnecting') and coalesce(participant.last_seen_at,participant.updated_at)<target_stale_before
    returning participant.id
  ) select coalesce(array_agg(id),'{}'::uuid[]),count(*)::integer into stale_ids,affected_count from stale;

  if affected_count>0 then
    update public.meeting_participant_tracks set state='unpublished',unpublished_at=coalesce(unpublished_at,now()),updated_at=now() where participant_id=any(stale_ids) and state='published';
    update public.meeting_participant_runtime_state set hand_raised=false,hand_raised_at=null,server_version=server_version+1,updated_at=now() where participant_id=any(stale_ids);
    update public.meeting_attendance attendance set left_at=coalesce(attendance.left_at,now()),duration_seconds=greatest(0,extract(epoch from (coalesce(attendance.left_at,now())-attendance.joined_at))::integer),final_state='disconnected',updated_at=now() where attendance.session_id=target_session_id and attendance.left_at is null and exists(select 1 from public.meeting_session_participants participant where participant.id=any(stale_ids) and attendance.participant_identity_hash=encode(digest(participant.provider_identity,'sha256'),'hex'));
    update public.meeting_sessions set participant_count=(select count(*) from public.meeting_session_participants where session_id=target_session_id and state in ('joining','connected','reconnecting')),last_event_sequence=last_event_sequence+1,updated_at=now() where id=target_session_id returning last_event_sequence into next_sequence;
    insert into public.meeting_events(room_id,session_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at)
    values(session_record.room_id,target_session_id,'participant_reconciliation_cleanup','backend','cleanup:'||target_session_id::text||':'||extract(epoch from target_stale_before)::bigint,next_sequence,jsonb_build_object('affectedCount',affected_count),now()) on conflict(event_source,idempotency_key) do nothing;
  end if;
  return jsonb_build_object('sessionId',target_session_id,'affected',affected_count,'participantIds',to_jsonb(stale_ids),'staleBefore',target_stale_before);
end;
$$;
revoke all on function public.cleanup_stale_meeting_participants(uuid,timestamptz) from public,anon;
grant execute on function public.cleanup_stale_meeting_participants(uuid,timestamptz) to authenticated,service_role;
do $$
declare table_name text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach table_name in array array['meeting_session_participants','meeting_participant_tracks','meeting_participant_runtime_state'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
        execute format('alter publication supabase_realtime add table public.%I',table_name);
      end if;
    end loop;
  end if;
end $$;
