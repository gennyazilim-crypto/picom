-- Production DM voice/video call information system.
-- Persistent call history, participant state, invitations and quality metadata are
-- private to direct-conversation participants. Clients mutate state only through
-- the SECURITY DEFINER RPCs below; LiveKit secrets remain server-side.
begin;

create table if not exists public.dm_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  livekit_room_name text not null unique check (livekit_room_name ~ '^direct-call:[0-9a-f-]{36}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  call_type text not null check (call_type in ('voice','video')),
  status text not null default 'ringing' check (status in ('ringing','active','declined','canceled','missed','busy','failed','completed')),
  started_at timestamptz not null default now(),
  connected_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  screen_share_used boolean not null default false,
  recording_status text not null default 'disabled' check (recording_status in ('disabled','pending','active','stopped','failed')),
  ended_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_call_participants (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.dm_calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invitation_status text not null default 'ringing' check (invitation_status in ('ringing','accepted','declined','canceled','missed','busy')),
  joined_at timestamptz,
  left_at timestamptz,
  microphone_enabled boolean not null default true,
  camera_enabled boolean not null default false,
  screen_share_enabled boolean not null default false,
  reconnect_count integer not null default 0 check (reconnect_count >= 0),
  final_status text not null default 'invited' check (final_status in ('invited','connecting','connected','reconnecting','disconnected','left')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(call_id, user_id)
);

create table if not exists public.dm_call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.dm_calls(id) on delete cascade,
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 64),
  event_key text not null check (char_length(event_key) between 1 and 180),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(call_id, event_key)
);

create table if not exists public.dm_call_invitations (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.dm_calls(id) on delete cascade,
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'ringing' check (status in ('ringing','accepted','declined','canceled','missed','busy')),
  expires_at timestamptz not null,
  responded_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(call_id, invitee_id)
);

create table if not exists public.dm_call_device_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.dm_calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_kind text not null check (device_kind in ('microphone','speaker','camera')),
  event_type text not null check (event_type in ('selected','lost','recovered','permission_denied')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dm_call_quality_samples (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.dm_calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ping_ms numeric(8,2),
  jitter_ms numeric(8,2),
  packet_loss_percent numeric(6,3),
  upload_bitrate_kbps integer,
  download_bitrate_kbps integer,
  audio_codec text,
  video_codec text,
  connection_type text,
  livekit_region text,
  reconnect_count integer not null default 0,
  quality text not null default 'unknown' check (quality in ('excellent','good','unstable','poor','reconnecting','unknown')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_dm_calls_one_open_per_conversation
  on public.dm_calls(conversation_id) where status in ('ringing','active');
create index if not exists idx_dm_calls_conversation_started on public.dm_calls(conversation_id, started_at desc, id desc);
create index if not exists idx_dm_calls_created_by on public.dm_calls(created_by, started_at desc);
create index if not exists idx_dm_call_participants_user on public.dm_call_participants(user_id, call_id);
create index if not exists idx_dm_call_events_conversation on public.dm_call_events(conversation_id, created_at desc);
create index if not exists idx_dm_call_invitations_invitee on public.dm_call_invitations(invitee_id, status, created_at desc);
create index if not exists idx_dm_call_quality_call on public.dm_call_quality_samples(call_id, created_at desc);

create or replace function public.touch_dm_call_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists dm_calls_touch_updated_at on public.dm_calls;
create trigger dm_calls_touch_updated_at before update on public.dm_calls
for each row execute function public.touch_dm_call_updated_at();
drop trigger if exists dm_call_participants_touch_updated_at on public.dm_call_participants;
create trigger dm_call_participants_touch_updated_at before update on public.dm_call_participants
for each row execute function public.touch_dm_call_updated_at();
drop trigger if exists dm_call_invitations_touch_updated_at on public.dm_call_invitations;
create trigger dm_call_invitations_touch_updated_at before update on public.dm_call_invitations
for each row execute function public.touch_dm_call_updated_at();

create or replace function public.dm_call_snapshot(target_call_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'id', call.id,
    'conversation_id', call.conversation_id,
    'livekit_room_name', call.livekit_room_name,
    'created_by', call.created_by,
    'call_type', call.call_type,
    'status', call.status,
    'started_at', call.started_at,
    'connected_at', call.connected_at,
    'ended_at', call.ended_at,
    'duration_seconds', call.duration_seconds,
    'screen_share_used', call.screen_share_used,
    'recording_status', call.recording_status,
    'created_at', call.created_at,
    'updated_at', call.updated_at,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', participant.user_id,
        'display_name', profile.display_name,
        'username', profile.username,
        'avatar_url', profile.avatar_url,
        'invitation_status', participant.invitation_status,
        'joined_at', participant.joined_at,
        'left_at', participant.left_at,
        'microphone_enabled', participant.microphone_enabled,
        'camera_enabled', participant.camera_enabled,
        'screen_share_enabled', participant.screen_share_enabled,
        'reconnect_count', participant.reconnect_count,
        'final_status', participant.final_status
      ) order by participant.created_at)
      from public.dm_call_participants participant
      join public.profiles profile on profile.id = participant.user_id
      where participant.call_id = call.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'call_id', event.call_id,
        'actor_id', event.actor_id,
        'event_type', event.event_type,
        'metadata', event.metadata,
        'created_at', event.created_at
      ) order by event.created_at)
      from public.dm_call_events event where event.call_id = call.id
    ), '[]'::jsonb),
    'invitation', (
      select jsonb_build_object(
        'id', invitation.id,
        'inviter_id', invitation.inviter_id,
        'invitee_id', invitation.invitee_id,
        'status', invitation.status,
        'expires_at', invitation.expires_at,
        'responded_at', invitation.responded_at,
        'read_at', invitation.read_at
      ) from public.dm_call_invitations invitation
      where invitation.call_id = call.id and invitation.invitee_id = auth.uid()
      limit 1
    ),
    'unread', exists(
      select 1 from public.dm_call_invitations invitation
      where invitation.call_id = call.id and invitation.invitee_id = auth.uid()
        and invitation.read_at is null and call.status in ('missed','declined','busy','failed')
    )
  )
  from public.dm_calls call
  where call.id = target_call_id
    and public.is_direct_conversation_participant(call.conversation_id)
$$;

create or replace function public.expire_stale_direct_calls()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare affected integer := 0;
begin
  update public.dm_calls call
  set status = 'missed', ended_at = now(), duration_seconds = 0
  where call.status = 'ringing'
    and call.started_at < now() - interval '45 seconds'
    and public.is_direct_conversation_participant(call.conversation_id);
  get diagnostics affected = row_count;
  update public.dm_call_invitations invitation
  set status = 'missed', responded_at = coalesce(responded_at, now())
  from public.dm_calls call
  where call.id = invitation.call_id and call.status = 'missed' and invitation.status = 'ringing';
  update public.dm_call_participants participant
  set invitation_status = 'missed', final_status = 'left', left_at = coalesce(left_at, now())
  from public.dm_calls call
  where call.id = participant.call_id and call.status = 'missed' and participant.invitation_status = 'ringing';
  return affected;
end $$;

create or replace function public.list_direct_calls(target_conversation_id uuid default null, result_limit integer default 100)
returns table(call jsonb) language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.expire_stale_direct_calls();
  return query
  select public.dm_call_snapshot(item.id)
  from public.dm_calls item
  where (target_conversation_id is null or item.conversation_id = target_conversation_id)
    and public.is_direct_conversation_participant(item.conversation_id)
  order by item.started_at desc, item.id desc
  limit greatest(1, least(coalesce(result_limit, 100), 250));
end $$;

create or replace function public.get_direct_call(target_call_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select public.dm_call_snapshot(target_call_id)
$$;

create or replace function public.get_current_active_direct_call()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select public.dm_call_snapshot(call.id)
  from public.dm_calls call
  join public.dm_call_participants participant on participant.call_id = call.id and participant.user_id = auth.uid()
  where call.status in ('ringing','active')
  order by call.started_at desc limit 1
$$;

create or replace function public.start_direct_call(target_conversation_id uuid, target_user_id uuid, target_call_type text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare existing_call_id uuid; new_call_id uuid := gen_random_uuid(); participant_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_call_type not in ('voice','video') then raise exception 'DM_CALL_TYPE_INVALID' using errcode='22023'; end if;
  if target_user_id = auth.uid() then raise exception 'DM_CALL_SELF_FORBIDDEN' using errcode='22023'; end if;
  if not public.is_direct_conversation_participant(target_conversation_id) then raise exception 'DM_CALL_FORBIDDEN' using errcode='42501'; end if;
  select count(*) into participant_count from public.direct_conversation_participants where conversation_id = target_conversation_id;
  if participant_count <> 2 or not exists (
    select 1 from public.direct_conversation_participants
    where conversation_id = target_conversation_id and user_id = target_user_id
  ) then raise exception 'DM_CALL_TARGET_INVALID' using errcode='42501'; end if;
  if public.users_are_blocked(auth.uid(), target_user_id) then raise exception 'DM_CALL_BLOCKED' using errcode='42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended('dm-call-user:' || least(auth.uid()::text, target_user_id::text), 0));
  perform pg_advisory_xact_lock(hashtextextended('dm-call-user:' || greatest(auth.uid()::text, target_user_id::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(target_conversation_id::text, 0));
  perform public.expire_stale_direct_calls();
  select id into existing_call_id from public.dm_calls
  where conversation_id = target_conversation_id and status in ('ringing','active')
  order by started_at desc limit 1;
  if existing_call_id is not null then return public.dm_call_snapshot(existing_call_id); end if;
  if exists (
    select 1 from public.dm_calls call
    join public.dm_call_participants participant on participant.call_id = call.id
    where participant.user_id in (auth.uid(), target_user_id)
      and call.status in ('ringing','active')
      and call.conversation_id <> target_conversation_id
  ) then raise exception 'DM_CALL_BUSY' using errcode='P0001'; end if;

  insert into public.dm_calls(id, conversation_id, livekit_room_name, created_by, call_type)
  values(new_call_id, target_conversation_id, 'direct-call:' || new_call_id::text, auth.uid(), target_call_type);
  insert into public.dm_call_participants(call_id, user_id, invitation_status, final_status)
  select new_call_id, participant.user_id,
    case when participant.user_id = auth.uid() then 'accepted' else 'ringing' end,
    case when participant.user_id = auth.uid() then 'connecting' else 'invited' end
  from public.direct_conversation_participants participant where participant.conversation_id = target_conversation_id;
  insert into public.dm_call_invitations(call_id, conversation_id, inviter_id, invitee_id, expires_at)
  values(new_call_id, target_conversation_id, auth.uid(), target_user_id, now() + interval '30 seconds');
  insert into public.dm_call_events(call_id, conversation_id, actor_id, event_type, event_key, metadata)
  values(new_call_id, target_conversation_id, auth.uid(), 'call_started', 'call_started', jsonb_build_object('call_type', target_call_type));
  return public.dm_call_snapshot(new_call_id);
end $$;

create or replace function public.respond_direct_call(target_call_id uuid, target_response text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_conversation uuid; target_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_response not in ('accepted','declined','busy') then raise exception 'DM_CALL_RESPONSE_INVALID' using errcode='22023'; end if;
  select call.conversation_id into target_conversation from public.dm_calls call
  join public.dm_call_invitations invitation on invitation.call_id = call.id and invitation.invitee_id = auth.uid()
  where call.id = target_call_id and call.status in ('ringing','active') for update of call;
  if target_conversation is null then raise exception 'DM_CALL_INVITATION_FORBIDDEN' using errcode='42501'; end if;
  update public.dm_call_invitations set status = target_response, responded_at = now(), read_at = now()
  where call_id = target_call_id and invitee_id = auth.uid();
  update public.dm_call_participants set invitation_status = target_response,
    final_status = case when target_response = 'accepted' then 'connecting' else 'left' end,
    left_at = case when target_response = 'accepted' then null else now() end
  where call_id = target_call_id and user_id = auth.uid();
  if target_response <> 'accepted' then
    target_status := case target_response when 'declined' then 'declined' else 'busy' end;
    update public.dm_calls set status = target_status, ended_at = now(), duration_seconds = 0 where id = target_call_id;
  end if;
  insert into public.dm_call_events(call_id, conversation_id, actor_id, event_type, event_key, metadata)
  values(target_call_id, target_conversation, auth.uid(), 'invitation_' || target_response, 'response:' || auth.uid()::text,
    jsonb_build_object('response', target_response)) on conflict(call_id, event_key) do nothing;
  return public.dm_call_snapshot(target_call_id);
end $$;

create or replace function public.update_direct_call_participant(
  target_call_id uuid,
  target_state text,
  target_microphone_enabled boolean default null,
  target_camera_enabled boolean default null,
  target_screen_share_enabled boolean default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_conversation uuid; event_key_value text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_state not in ('connecting','connected','reconnecting','disconnected','left') then raise exception 'DM_CALL_STATE_INVALID' using errcode='22023'; end if;
  select call.conversation_id into target_conversation from public.dm_calls call
  join public.dm_call_participants participant on participant.call_id = call.id and participant.user_id = auth.uid()
  where call.id = target_call_id and call.status in ('ringing','active') for update of call;
  if target_conversation is null then raise exception 'DM_CALL_FORBIDDEN' using errcode='42501'; end if;
  update public.dm_call_participants participant set
    invitation_status = case when target_state in ('connected','reconnecting') then 'accepted' else participant.invitation_status end,
    joined_at = case when target_state = 'connected' then coalesce(participant.joined_at, now()) else participant.joined_at end,
    left_at = case when target_state in ('left','disconnected') then now() when target_state = 'connected' then null else participant.left_at end,
    microphone_enabled = coalesce(target_microphone_enabled, participant.microphone_enabled),
    camera_enabled = coalesce(target_camera_enabled, participant.camera_enabled),
    screen_share_enabled = coalesce(target_screen_share_enabled, participant.screen_share_enabled),
    reconnect_count = participant.reconnect_count + case when target_state = 'reconnecting' and participant.final_status <> 'reconnecting' then 1 else 0 end,
    final_status = target_state,
    last_seen_at = now()
  where participant.call_id = target_call_id and participant.user_id = auth.uid();
  if target_state = 'connected' then
    update public.dm_calls set status = 'active', connected_at = coalesce(connected_at, now()),
      screen_share_used = screen_share_used or coalesce(target_screen_share_enabled, false)
    where id = target_call_id and (
      select count(*) from public.dm_call_participants connected_participant
      where connected_participant.call_id = target_call_id and connected_participant.final_status = 'connected'
    ) >= 2;
  elsif coalesce(target_screen_share_enabled, false) then
    update public.dm_calls set screen_share_used = true where id = target_call_id;
  end if;
  event_key_value := 'participant:' || auth.uid()::text || ':' || target_state || ':'
    || coalesce(target_microphone_enabled::text, 'same') || ':' || coalesce(target_camera_enabled::text, 'same') || ':'
    || coalesce(target_screen_share_enabled::text, 'same');
  insert into public.dm_call_events(call_id, conversation_id, actor_id, event_type, event_key, metadata)
  values(target_call_id, target_conversation, auth.uid(), 'participant_' || target_state, event_key_value,
    jsonb_build_object('microphone_enabled', target_microphone_enabled, 'camera_enabled', target_camera_enabled, 'screen_share_enabled', target_screen_share_enabled))
  on conflict(call_id, event_key) do nothing;
  return public.dm_call_snapshot(target_call_id);
end $$;

create or replace function public.finish_direct_call(target_call_id uuid, target_status text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_conversation uuid; current_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_status not in ('declined','canceled','missed','busy','failed','completed') then raise exception 'DM_CALL_FINAL_STATUS_INVALID' using errcode='22023'; end if;
  select call.conversation_id, call.status into target_conversation, current_status from public.dm_calls call
  where call.id = target_call_id and public.is_direct_conversation_participant(call.conversation_id) for update;
  if target_conversation is null then raise exception 'DM_CALL_FORBIDDEN' using errcode='42501'; end if;
  if current_status in ('declined','canceled','missed','busy','failed','completed') then return public.dm_call_snapshot(target_call_id); end if;
  update public.dm_calls call set status = target_status, ended_at = now(), ended_by = auth.uid(),
    duration_seconds = greatest(0, floor(extract(epoch from (now() - coalesce(call.connected_at, call.started_at))))::integer)
  where call.id = target_call_id;
  update public.dm_call_participants set left_at = coalesce(left_at, now()), final_status = 'left', screen_share_enabled = false
  where call_id = target_call_id;
  update public.dm_call_invitations set
    status = case when status = 'ringing' then case when target_status = 'missed' then 'missed' else 'canceled' end else status end,
    responded_at = coalesce(responded_at, now()) where call_id = target_call_id;
  insert into public.dm_call_events(call_id, conversation_id, actor_id, event_type, event_key, metadata)
  values(target_call_id, target_conversation, auth.uid(), 'call_ended', 'call_ended', jsonb_build_object('status', target_status))
  on conflict(call_id, event_key) do nothing;
  update public.direct_conversations set updated_at = now() where id = target_conversation;
  return public.dm_call_snapshot(target_call_id);
end $$;

create or replace function public.mark_direct_call_read(target_call_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then return false; end if;
  update public.dm_call_invitations invitation set read_at = now()
  where invitation.call_id = target_call_id and invitation.invitee_id = auth.uid()
    and exists(select 1 from public.dm_calls call where call.id = invitation.call_id and public.is_direct_conversation_participant(call.conversation_id));
  return found;
end $$;

create or replace function public.record_direct_call_quality(
  target_call_id uuid, target_quality text, target_reconnect_count integer default 0,
  target_ping_ms numeric default null, target_jitter_ms numeric default null,
  target_packet_loss_percent numeric default null, target_upload_bitrate_kbps integer default null,
  target_download_bitrate_kbps integer default null, target_audio_codec text default null,
  target_video_codec text default null, target_connection_type text default null, target_livekit_region text default null
)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if target_quality not in ('excellent','good','unstable','poor','reconnecting','unknown') then return false; end if;
  if not exists(select 1 from public.dm_call_participants participant where participant.call_id = target_call_id and participant.user_id = auth.uid()) then return false; end if;
  insert into public.dm_call_quality_samples(call_id,user_id,ping_ms,jitter_ms,packet_loss_percent,upload_bitrate_kbps,download_bitrate_kbps,audio_codec,video_codec,connection_type,livekit_region,reconnect_count,quality)
  values(target_call_id,auth.uid(),target_ping_ms,target_jitter_ms,target_packet_loss_percent,target_upload_bitrate_kbps,target_download_bitrate_kbps,left(target_audio_codec,40),left(target_video_codec,40),left(target_connection_type,40),left(target_livekit_region,80),greatest(0,target_reconnect_count),target_quality);
  return true;
end $$;

create or replace function public.record_direct_call_device_event(target_call_id uuid, target_device_kind text, target_event_type text, target_device_id_hash text default null, target_device_label text default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare target_conversation_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_device_kind not in ('microphone','speaker','camera','screen_share') then raise exception 'DM_CALL_DEVICE_KIND_INVALID' using errcode='22023'; end if;
  if target_event_type not in ('selected','enabled','disabled','muted','unmuted','failed','recovered','connected') then raise exception 'DM_CALL_DEVICE_EVENT_INVALID' using errcode='22023'; end if;
  select call.conversation_id into target_conversation_id from public.dm_calls call
  join public.dm_call_participants participant on participant.call_id=call.id and participant.user_id=auth.uid()
  where call.id=target_call_id;
  if target_conversation_id is null or not public.is_direct_conversation_participant(target_conversation_id) then raise exception 'DM_CALL_FORBIDDEN' using errcode='42501'; end if;
  insert into public.dm_call_device_events(call_id,user_id,device_kind,event_type,device_id_hash,device_label)
  values(target_call_id,auth.uid(),target_device_kind,target_event_type,left(nullif(target_device_id_hash,''),128),left(nullif(target_device_label,''),120));
  return true;
end $$;

create or replace function public.authorize_direct_call_livekit(target_call_id uuid, target_intent text)
returns table(conversation_id uuid, room_name text, can_publish_audio boolean, can_publish_video boolean, can_publish_screen boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_intent not in ('voice','video','screen') then raise exception 'VOICE_INTENT_INVALID' using errcode='22023'; end if;
  return query select call.conversation_id, call.livekit_room_name, true, call.call_type = 'video', true
  from public.dm_calls call
  join public.dm_call_participants participant on participant.call_id = call.id and participant.user_id = auth.uid()
  where call.id = target_call_id and call.status in ('ringing','active')
    and call.started_at > now() - interval '4 hours'
    and public.is_direct_conversation_participant(call.conversation_id)
    and not exists (
      select 1 from public.direct_conversation_participants other
      where other.conversation_id = call.conversation_id and other.user_id <> auth.uid()
        and public.users_are_blocked(auth.uid(), other.user_id)
    );
end $$;

alter table public.dm_calls enable row level security;
alter table public.dm_call_participants enable row level security;
alter table public.dm_call_events enable row level security;
alter table public.dm_call_invitations enable row level security;
alter table public.dm_call_device_events enable row level security;
alter table public.dm_call_quality_samples enable row level security;

drop policy if exists dm_calls_select_participants on public.dm_calls;
create policy dm_calls_select_participants on public.dm_calls for select to authenticated
using (public.is_direct_conversation_participant(conversation_id));
drop policy if exists dm_call_participants_select_participants on public.dm_call_participants;
create policy dm_call_participants_select_participants on public.dm_call_participants for select to authenticated
using (exists(select 1 from public.dm_calls call where call.id = call_id and public.is_direct_conversation_participant(call.conversation_id)));
drop policy if exists dm_call_events_select_participants on public.dm_call_events;
create policy dm_call_events_select_participants on public.dm_call_events for select to authenticated
using (public.is_direct_conversation_participant(conversation_id));
drop policy if exists dm_call_invitations_select_participants on public.dm_call_invitations;
create policy dm_call_invitations_select_participants on public.dm_call_invitations for select to authenticated
using (public.is_direct_conversation_participant(conversation_id));
drop policy if exists dm_call_device_events_select_own on public.dm_call_device_events;
create policy dm_call_device_events_select_own on public.dm_call_device_events for select to authenticated
using (user_id = auth.uid() and exists(select 1 from public.dm_calls call where call.id = call_id and public.is_direct_conversation_participant(call.conversation_id)));
drop policy if exists dm_call_quality_select_own on public.dm_call_quality_samples;
create policy dm_call_quality_select_own on public.dm_call_quality_samples for select to authenticated
using (user_id = auth.uid() and exists(select 1 from public.dm_calls call where call.id = call_id and public.is_direct_conversation_participant(call.conversation_id)));

revoke all on public.dm_calls, public.dm_call_participants, public.dm_call_events, public.dm_call_invitations, public.dm_call_device_events, public.dm_call_quality_samples from anon, authenticated;
grant select on public.dm_calls, public.dm_call_participants, public.dm_call_events, public.dm_call_invitations, public.dm_call_device_events, public.dm_call_quality_samples to authenticated;
revoke all on function public.dm_call_snapshot(uuid), public.expire_stale_direct_calls(), public.list_direct_calls(uuid,integer), public.get_direct_call(uuid), public.get_current_active_direct_call(), public.start_direct_call(uuid,uuid,text), public.respond_direct_call(uuid,text), public.update_direct_call_participant(uuid,text,boolean,boolean,boolean), public.finish_direct_call(uuid,text), public.mark_direct_call_read(uuid), public.record_direct_call_quality(uuid,text,integer,numeric,numeric,numeric,integer,integer,text,text,text,text), public.record_direct_call_device_event(uuid,text,text,text,text), public.authorize_direct_call_livekit(uuid,text) from public, anon;
grant execute on function public.list_direct_calls(uuid,integer), public.get_direct_call(uuid), public.get_current_active_direct_call(), public.start_direct_call(uuid,uuid,text), public.respond_direct_call(uuid,text), public.update_direct_call_participant(uuid,text,boolean,boolean,boolean), public.finish_direct_call(uuid,text), public.mark_direct_call_read(uuid), public.record_direct_call_quality(uuid,text,integer,numeric,numeric,numeric,integer,integer,text,text,text,text), public.record_direct_call_device_event(uuid,text,text,text,text), public.authorize_direct_call_livekit(uuid,text) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dm_calls') then alter publication supabase_realtime add table public.dm_calls; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dm_call_participants') then alter publication supabase_realtime add table public.dm_call_participants; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dm_call_events') then alter publication supabase_realtime add table public.dm_call_events; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dm_call_invitations') then alter publication supabase_realtime add table public.dm_call_invitations; end if;
end $$;

comment on table public.dm_calls is 'Participant-only DM call lifecycle and authoritative duration anchor.';
comment on table public.dm_call_quality_samples is 'Short operational samples only; no media, message content, token, IP address or secret is stored.';
commit;
