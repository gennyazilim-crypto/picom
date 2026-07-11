-- Task 536: verified LiveKit webhooks are authoritative for meeting lifecycle and attendance.
-- Raw webhook bodies, media payloads, provider secrets, and authorization headers are never stored.
begin;

create table if not exists public.livekit_webhook_receipts (
  event_id text primary key check (event_id ~ '^[0-9a-fA-F-]{36}$'),
  event_type text not null check (event_type in ('room_started','room_finished','participant_joined','participant_left','participant_connection_aborted','track_published','track_unpublished')),
  room_name text not null check (char_length(room_name) between 1 and 180),
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'processing' check (status in ('processing','processed','failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 1000),
  error_code text check (error_code is null or error_code ~ '^[A-Z0-9_:-]{1,80}$'),
  first_received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.meeting_participant_tracks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  participant_id uuid not null references public.meeting_session_participants(id) on delete cascade,
  provider_track_sid text not null check (char_length(provider_track_sid) between 1 and 180),
  kind text not null check (kind in ('audio','video')),
  source text not null check (source in ('microphone','camera','screen_share','screen_share_audio','unknown')),
  state text not null check (state in ('published','unpublished')),
  published_at timestamptz not null,
  unpublished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(session_id,provider_track_sid),
  check (unpublished_at is null or unpublished_at>=published_at)
);

create unique index if not exists meeting_attendance_session_identity_unique on public.meeting_attendance(session_id,participant_identity_hash);
create index if not exists idx_livekit_webhook_receipts_status_time on public.livekit_webhook_receipts(status,last_received_at);
create index if not exists idx_meeting_participant_tracks_participant_state on public.meeting_participant_tracks(participant_id,state,updated_at desc);

alter table public.livekit_webhook_receipts enable row level security;
alter table public.meeting_participant_tracks enable row level security;
revoke all on table public.livekit_webhook_receipts from public,anon,authenticated;
revoke all on table public.meeting_participant_tracks from public,anon,authenticated;
grant select on table public.meeting_participant_tracks to authenticated;

drop policy if exists meeting_participant_tracks_visible_select on public.meeting_participant_tracks;
create policy meeting_participant_tracks_visible_select on public.meeting_participant_tracks for select to authenticated using (
  exists(select 1 from public.meeting_sessions session where session.id=meeting_participant_tracks.session_id and public.can_view_meeting_sensitive(session.room_id))
);

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
  participant_user_id uuid;
  participant_role text:='guest';
  participant_display_name text;
  identity_hash text;
  next_sequence bigint;
  safe_payload jsonb:='{}'::jsonb;
  final_attendance_state text:='left';
  failure_state text;
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
  if receipt_record.payload_digest<>target_payload_digest then
    return jsonb_build_object('processed',false,'duplicate',false,'errorCode','WEBHOOK_REPLAY_MISMATCH');
  end if;
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
      insert into public.meeting_session_participants(session_id,user_id,provider_identity,display_name,role,state,capabilities,joined_at,last_seen_at,updated_at)
      values(target_session_id,participant_user_id,target_participant_identity,participant_display_name,participant_role,case when target_event_type='participant_joined' then 'connected' else 'joining' end,'{}'::jsonb,case when target_event_type='participant_joined' then target_occurred_at else null end,target_occurred_at,now())
      on conflict(session_id,provider_identity) do update set user_id=coalesce(excluded.user_id,meeting_session_participants.user_id),display_name=excluded.display_name,role=excluded.role,state=case when target_event_type='participant_joined' then 'connected' else meeting_session_participants.state end,joined_at=case when target_event_type='participant_joined' then coalesce(meeting_session_participants.joined_at,excluded.joined_at) else meeting_session_participants.joined_at end,last_seen_at=target_occurred_at,updated_at=now()
      returning * into participant_record;
    end if;

    if target_event_type='room_started' then
      update public.meeting_sessions set status='live',connection_state='connected',started_at=coalesce(started_at,target_occurred_at),updated_at=now() where id=target_session_id;
      update public.meeting_rooms set status='live',updated_at=now() where id=target_room_id and status in ('open','scheduled','live');
    elsif target_event_type='room_finished' then
      update public.meeting_sessions set status='ended',connection_state='disconnected',started_at=coalesce(started_at,target_occurred_at),ended_at=coalesce(ended_at,target_occurred_at),participant_count=0,updated_at=now() where id=target_session_id;
      update public.meeting_session_participants set state='left',left_at=coalesce(left_at,target_occurred_at),last_seen_at=target_occurred_at,updated_at=now() where session_id=target_session_id and state in ('invited','waiting','joining','connected','reconnecting');
      update public.meeting_participant_tracks set state='unpublished',unpublished_at=coalesce(unpublished_at,target_occurred_at),updated_at=now() where session_id=target_session_id and state='published';
      update public.meeting_attendance set left_at=coalesce(left_at,target_occurred_at),duration_seconds=greatest(0,extract(epoch from (coalesce(left_at,target_occurred_at)-joined_at))::integer),final_state='ended',updated_at=now() where session_id=target_session_id and left_at is null;
      update public.meeting_rooms set status='ended',ended_at=coalesce(ended_at,target_occurred_at),updated_at=now() where id=target_room_id and status not in ('cancelled','ended');
    elsif target_event_type='participant_joined' then
      insert into public.meeting_attendance(session_id,user_id,participant_identity_hash,role,joined_at,left_at,duration_seconds,reconnect_count,final_state,updated_at)
      values(target_session_id,participant_user_id,identity_hash,participant_role,target_occurred_at,null,null,0,'left',now())
      on conflict(session_id,participant_identity_hash) do update set user_id=coalesce(excluded.user_id,meeting_attendance.user_id),role=excluded.role,joined_at=case when meeting_attendance.left_at is not null then excluded.joined_at else meeting_attendance.joined_at end,left_at=null,duration_seconds=null,reconnect_count=case when meeting_attendance.left_at is not null then meeting_attendance.reconnect_count+1 else meeting_attendance.reconnect_count end,updated_at=now();
      update public.meeting_sessions set participant_count=(select count(*) from public.meeting_session_participants where session_id=target_session_id and state in ('joining','connected','reconnecting')),updated_at=now() where id=target_session_id;
    elsif target_event_type in ('participant_left','participant_connection_aborted') then
      final_attendance_state:=case when target_event_type='participant_connection_aborted' then 'disconnected' else 'left' end;
      update public.meeting_session_participants set state='left',left_at=coalesce(left_at,target_occurred_at),last_seen_at=target_occurred_at,updated_at=now() where id=participant_record.id;
      update public.meeting_attendance set user_id=coalesce(user_id,participant_user_id),role=participant_role,left_at=coalesce(left_at,target_occurred_at),duration_seconds=greatest(0,extract(epoch from (coalesce(left_at,target_occurred_at)-joined_at))::integer),final_state=final_attendance_state,updated_at=now() where session_id=target_session_id and participant_identity_hash=identity_hash;
      update public.meeting_sessions set participant_count=(select count(*) from public.meeting_session_participants where session_id=target_session_id and state in ('joining','connected','reconnecting')),updated_at=now() where id=target_session_id;
    elsif target_event_type in ('track_published','track_unpublished') then
      if target_track_sid is null or char_length(target_track_sid) not between 1 and 180 or target_track_kind not in ('audio','video') or target_track_source not in ('microphone','camera','screen_share','screen_share_audio','unknown') then raise exception 'LIVEKIT_TRACK_INVALID'; end if;
      insert into public.meeting_participant_tracks(session_id,participant_id,provider_track_sid,kind,source,state,published_at,unpublished_at,updated_at)
      values(target_session_id,participant_record.id,target_track_sid,target_track_kind,target_track_source,case when target_event_type='track_published' then 'published' else 'unpublished' end,target_occurred_at,case when target_event_type='track_unpublished' then target_occurred_at else null end,now())
      on conflict(session_id,provider_track_sid) do update set participant_id=excluded.participant_id,kind=excluded.kind,source=excluded.source,state=excluded.state,published_at=case when excluded.state='published' then excluded.published_at else meeting_participant_tracks.published_at end,unpublished_at=excluded.unpublished_at,updated_at=now();
    end if;

    update public.meeting_sessions set last_event_sequence=last_event_sequence+1,updated_at=now() where id=target_session_id returning last_event_sequence into next_sequence;
    safe_payload:=jsonb_strip_nulls(jsonb_build_object('participantIdentityHash',identity_hash,'trackSid',target_track_sid,'trackKind',target_track_kind,'trackSource',target_track_source,'state',case when target_event_type in ('participant_left','participant_connection_aborted','track_unpublished','room_finished') then 'ended' else 'active' end));
    insert into public.meeting_events(room_id,session_id,actor_user_id,actor_participant_id,event_type,event_source,provider_event_id,idempotency_key,sequence,payload,occurred_at)
    values(target_room_id,target_session_id,participant_user_id,participant_record.id,target_event_type,'livekit',lower(target_event_id),lower(target_event_id),next_sequence,safe_payload,target_occurred_at)
    on conflict(event_source,idempotency_key) do nothing;
    update public.livekit_webhook_receipts set status='processed',processed_at=now(),error_code=null,last_received_at=now() where event_id=lower(target_event_id);
    return jsonb_build_object('processed',true,'duplicate',false,'eventId',lower(target_event_id),'eventType',target_event_type,'sessionId',target_session_id,'sequence',next_sequence);
  exception when others then
    get stacked diagnostics failure_state=returned_sqlstate;
    update public.livekit_webhook_receipts set status='failed',error_code=left('PROCESSING_'||coalesce(failure_state,'UNKNOWN'),80),last_received_at=now() where event_id=lower(target_event_id);
    return jsonb_build_object('processed',false,'duplicate',false,'eventId',lower(target_event_id),'eventType',target_event_type,'errorCode',left('PROCESSING_'||coalesce(failure_state,'UNKNOWN'),80));
  end;
end;
$$;

revoke all on function public.process_livekit_webhook_event(text,text,timestamptz,uuid,uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.process_livekit_webhook_event(text,text,timestamptz,uuid,uuid,text,text,text,text,text,text,text) to service_role;
comment on table public.livekit_webhook_receipts is 'Idempotency and retry state only. Raw webhook bodies, authorization headers, media, and secrets are prohibited.';
comment on function public.process_livekit_webhook_event(text,text,timestamptz,uuid,uuid,text,text,text,text,text,text,text) is 'Service-role-only reconciliation of verified LiveKit lifecycle events. Client events are not attendance authority.';

commit;
