-- TASK30: media storage bucket, signed playback, service webhook/finalize RPCs, moderation.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publisher-stream-recordings',
  'publisher-stream-recordings',
  false,
  3221225472, -- 3 GiB practical bound for controlled rollout; large-VOD may need external object store
  array['video/mp4', 'video/webm', 'application/vnd.apple.mpegurl', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- No broad authenticated storage write. Service role / Edge processing only.
drop policy if exists publisher_stream_recordings_no_client_insert on storage.objects;
-- Explicit deny via absence of insert policies for authenticated on this bucket.

create or replace function public.publisher_media_can_playback_replay(target_replay_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  replay_row public.publisher_replays%rowtype;
begin
  select * into replay_row from public.publisher_replays where id = target_replay_id;
  if not found then
    return false;
  end if;
  if replay_row.deleted_at is not null or replay_row.moderation_state in ('TAKEDOWN', 'DELETED') then
    return false;
  end if;
  if replay_row.status in ('DELETED', 'TAKEDOWN', 'DRAFT', 'PROCESSING') then
    return false;
  end if;
  if actor is not null and replay_row.publisher_user_id = actor then
    return true;
  end if;
  if replay_row.visibility = 'PUBLIC' and replay_row.status = 'PUBLISHED' and replay_row.moderation_state = 'VISIBLE' and replay_row.internal_test = false then
    return true;
  end if;
  -- UNLISTED: requires authenticated owner OR future opaque share token RPC (owner-only for now unless caller knows id and is authenticated guest path).
  -- Privacy: UUID obscurity is NOT sufficient; unlisted requires owner or explicit grant. Non-owners denied.
  return false;
end;
$$;

create or replace function public.create_publisher_replay_playback_url(
  target_replay_id uuid,
  ttl_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  replay_row public.publisher_replays%rowtype;
  rec public.publisher_recordings%rowtype;
  ttl integer := greatest(60, least(coalesce(ttl_seconds, 300), 900));
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_media_can_playback_replay(target_replay_id) then
    raise exception 'PLAYBACK_DENIED' using errcode = '42501';
  end if;

  select * into replay_row from public.publisher_replays where id = target_replay_id;
  select * into rec from public.publisher_recordings where id = replay_row.recording_id;
  if rec.storage_bucket is null or rec.storage_path is null or rec.status <> 'READY' then
    raise exception 'MEDIA_UNAVAILABLE';
  end if;

  -- Signed URL bytes are issued by Edge/storage API using service role; RPC returns path claim only.
  return jsonb_build_object(
    'replay_id', replay_row.id,
    'recording_id', rec.id,
    'bucket', rec.storage_bucket,
    'path', rec.storage_path,
    'content_type', coalesce(rec.content_type, 'video/mp4'),
    'duration_ms', coalesce(replay_row.duration_ms, rec.duration_ms),
    'ttl_seconds', ttl,
    'sign_required', true
  );
end;
$$;

create or replace function public.service_apply_publisher_egress_event(
  target_event_id text,
  target_event_type text,
  target_egress_id text,
  target_stream_id uuid default null,
  target_recording_id uuid default null,
  target_status text default null,
  target_storage_bucket text default null,
  target_storage_path text default null,
  target_size_bytes bigint default null,
  target_duration_ms bigint default null,
  target_failure_code text default null,
  target_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec public.publisher_recordings%rowtype;
  stream_row public.publisher_streams%rowtype;
  replay_row public.publisher_replays%rowtype;
  key text := 'egress:' || lower(btrim(coalesce(target_event_id, '')));
  mapped text;
begin
  if target_event_id is null or btrim(target_event_id) = '' then
    return jsonb_build_object('ok', false, 'error', 'EVENT_ID_REQUIRED');
  end if;

  -- Idempotency via audit metadata event id.
  if exists (
    select 1 from public.publisher_media_audit_events
    where metadata->>'provider_event_id' = lower(btrim(target_event_id))
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if target_recording_id is not null then
    select * into rec from public.publisher_recordings where id = target_recording_id for update;
  elsif target_egress_id is not null then
    select * into rec from public.publisher_recordings where provider_egress_id = target_egress_id for update;
  elsif target_stream_id is not null then
    select * into rec from public.publisher_recordings
    where stream_id = target_stream_id
      and status in ('REQUESTED', 'STARTING', 'RECORDING', 'STOPPING', 'PROCESSING')
    order by created_at desc limit 1 for update;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'RECORDING_NOT_FOUND');
  end if;

  select * into stream_row from public.publisher_streams where id = rec.stream_id;

  mapped := case target_event_type
    when 'egress_started' then 'RECORDING'
    when 'egress_updated' then coalesce(nullif(target_status, ''), rec.status)
    when 'egress_ended' then 'PROCESSING'
    when 'egress_failed' then 'FAILED'
    else null
  end;

  if mapped is null then
    return jsonb_build_object('ok', true, 'ignored', true);
  end if;

  update public.publisher_recordings
  set
    provider_egress_id = coalesce(provider_egress_id, nullif(target_egress_id, '')),
    status = case
      when mapped = 'FAILED' then 'FAILED'
      when mapped = 'PROCESSING' then 'PROCESSING'
      when mapped = 'RECORDING' and status in ('REQUESTED', 'STARTING') then 'RECORDING'
      else status
    end,
    storage_bucket = coalesce(nullif(target_storage_bucket, ''), storage_bucket),
    storage_path = coalesce(nullif(target_storage_path, ''), storage_path),
    size_bytes = coalesce(target_size_bytes, size_bytes),
    duration_ms = coalesce(target_duration_ms, duration_ms),
    ended_at = case when mapped in ('PROCESSING', 'FAILED') then coalesce(ended_at, target_occurred_at) else ended_at end,
    failure_code = case when mapped = 'FAILED' then coalesce(target_failure_code, 'EGRESS_FAILED') else failure_code end,
    processing_state = case when mapped = 'PROCESSING' then 'PROCESSING' when mapped = 'FAILED' then 'FAILED' else processing_state end,
    updated_at = now()
  where id = rec.id
  returning * into rec;

  perform public.publisher_media_append_audit(
    case when mapped = 'FAILED' then 'RECORDING_FAILED' else 'RECORDING_STOPPED' end,
    rec.stream_id, rec.id, null, null, null,
    jsonb_build_object('provider_event_id', lower(btrim(target_event_id)), 'event_type', target_event_type)
  );

  -- On file complete path (ended + path present): mark READY and create draft replay.
  if mapped = 'PROCESSING' and rec.storage_path is not null then
    update public.publisher_recordings
    set status = 'READY', processing_state = 'READY', updated_at = now()
    where id = rec.id
    returning * into rec;

    insert into public.publisher_replays (
      stream_id, recording_id, publisher_user_id, title, description, visibility, status, duration_ms, internal_test
    ) values (
      rec.stream_id, rec.id, rec.publisher_user_id,
      coalesce(stream_row.title, 'Replay'),
      coalesce(stream_row.description, ''),
      'PRIVATE', 'READY', rec.duration_ms, rec.internal_test
    )
    on conflict (recording_id) do update
      set status = case when public.publisher_replays.status in ('DELETED', 'TAKEDOWN') then public.publisher_replays.status else 'READY' end,
          duration_ms = coalesce(excluded.duration_ms, public.publisher_replays.duration_ms),
          updated_at = now()
    returning * into replay_row;

    perform public.publisher_media_append_audit(
      'REPLAY_CREATED', rec.stream_id, rec.id, replay_row.id, null, null,
      jsonb_build_object('provider_event_id', lower(btrim(target_event_id)))
    );
  end if;

  return jsonb_build_object('ok', true, 'recording_id', rec.id, 'status', rec.status, 'idempotency_key', key);
end;
$$;

create or replace function public.service_bind_publisher_recording_egress(
  target_recording_id uuid,
  target_egress_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec public.publisher_recordings%rowtype;
begin
  update public.publisher_recordings
  set provider_egress_id = nullif(btrim(target_egress_id), ''),
      status = case when status = 'REQUESTED' then 'STARTING' else status end,
      updated_at = now()
  where id = target_recording_id
  returning * into rec;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'RECORDING_NOT_FOUND');
  end if;
  return jsonb_build_object('ok', true, 'recording_id', rec.id, 'status', rec.status);
end;
$$;

create or replace function public.service_mark_publisher_recording_failed(
  target_recording_id uuid,
  target_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec public.publisher_recordings%rowtype;
begin
  update public.publisher_recordings
  set status = 'FAILED',
      processing_state = 'FAILED',
      failure_code = left(coalesce(nullif(btrim(target_failure_code), ''), 'PROVIDER_UNAVAILABLE'), 64),
      ended_at = coalesce(ended_at, now()),
      updated_at = now()
  where id = target_recording_id
  returning * into rec;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  perform public.publisher_media_append_audit(
    'RECORDING_FAILED', rec.stream_id, rec.id, null, null, null,
    jsonb_build_object('failure_code', rec.failure_code)
  );
  return jsonb_build_object('ok', true, 'status', rec.status);
end;
$$;

create or replace function public.root_moderate_publisher_replay(
  target_replay_id uuid,
  target_action text,
  target_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  replay_row public.publisher_replays%rowtype;
  can_root boolean;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  can_root := coalesce(public.is_root_owner() or public.has_platform_role('root_owner') or public.has_platform_role('platform_admin'), false);
  if not can_root then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  -- dashboard.read does NOT grant media moderation.
  if target_action not in ('takedown', 'restrict', 'restore') then
    raise exception 'ACTION_INVALID';
  end if;

  update public.publisher_replays
  set
    moderation_state = case target_action
      when 'takedown' then 'TAKEDOWN'
      when 'restrict' then 'RESTRICTED'
      when 'restore' then 'VISIBLE'
    end,
    status = case when target_action = 'takedown' then 'TAKEDOWN' else status end,
    moderation_reason = left(coalesce(target_reason, ''), 500),
    moderated_by = actor,
    moderated_at = now(),
    updated_at = now()
  where id = target_replay_id
  returning * into replay_row;
  if not found then
    raise exception 'REPLAY_NOT_FOUND';
  end if;

  perform public.publisher_media_append_audit(
    case when target_action = 'restore' then 'MEDIA_RESTORED' else 'MEDIA_TAKEDOWN' end,
    replay_row.stream_id, replay_row.recording_id, replay_row.id, null, actor,
    jsonb_build_object('action', target_action)
  );
  return jsonb_build_object('id', replay_row.id, 'moderation_state', replay_row.moderation_state);
end;
$$;

revoke all on function public.publisher_media_can_playback_replay(uuid) from public, anon;
revoke all on function public.create_publisher_replay_playback_url(uuid, integer) from public, anon;
revoke all on function public.service_apply_publisher_egress_event(text, text, text, uuid, uuid, text, text, text, bigint, bigint, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.service_bind_publisher_recording_egress(uuid, text) from public, anon, authenticated;
revoke all on function public.service_mark_publisher_recording_failed(uuid, text) from public, anon, authenticated;
revoke all on function public.root_moderate_publisher_replay(uuid, text, text) from public, anon;

grant execute on function public.publisher_media_can_playback_replay(uuid) to authenticated, service_role;
grant execute on function public.create_publisher_replay_playback_url(uuid, integer) to authenticated;
grant execute on function public.service_apply_publisher_egress_event(text, text, text, uuid, uuid, text, text, text, bigint, bigint, text, timestamptz)
  to service_role;
grant execute on function public.service_bind_publisher_recording_egress(uuid, text) to service_role;
grant execute on function public.service_mark_publisher_recording_failed(uuid, text) to service_role;
grant execute on function public.root_moderate_publisher_replay(uuid, text, text) to authenticated;

comment on function public.create_publisher_replay_playback_url(uuid, integer) is
  'Returns storage claim for Edge to mint bounded signed URL. Never stores signed URL in DB.';

commit;
