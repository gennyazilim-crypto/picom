-- TASK30: publisher recordings + replays core (metadata/RLS/RPC).
-- Provider start is Edge/service only. Clients cannot set READY or storage_path.

begin;

alter table public.publisher_streams
  add column if not exists recording_enabled boolean not null default false;

comment on column public.publisher_streams.recording_enabled is
  'MANUAL_RECORD opt-in. Default false. Recording never starts silently.';

create table if not exists public.publisher_recordings (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  publisher_user_id uuid not null references public.profiles(id) on delete cascade,
  recording_provider text not null default 'livekit_egress'
    check (recording_provider in ('livekit_egress')),
  provider_egress_id text,
  status text not null default 'REQUESTED'
    check (status in (
      'REQUESTED', 'STARTING', 'RECORDING', 'STOPPING', 'PROCESSING',
      'READY', 'FAILED', 'CANCELLED', 'DELETED'
    )),
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  source_type text not null default 'PICOM_NATIVE'
    check (source_type in ('PICOM_NATIVE', 'OBS_EXTERNAL', 'SYNTHETIC')),
  storage_bucket text,
  storage_path text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  content_type text,
  checksum text,
  video_codec text,
  audio_codec text,
  width integer,
  height integer,
  fps numeric,
  bitrate_kbps integer,
  processing_state text not null default 'PENDING'
    check (processing_state in ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'SKIPPED')),
  failure_code text,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publisher_recordings_path_pair check (
    (storage_path is null and storage_bucket is null)
    or (storage_path is not null and storage_bucket is not null)
  )
);

create unique index if not exists publisher_recordings_provider_egress_uidx
  on public.publisher_recordings (provider_egress_id)
  where provider_egress_id is not null;

create index if not exists publisher_recordings_stream_idx
  on public.publisher_recordings (stream_id, created_at desc);

create index if not exists publisher_recordings_publisher_idx
  on public.publisher_recordings (publisher_user_id, created_at desc);

create index if not exists publisher_recordings_active_idx
  on public.publisher_recordings (status)
  where status in ('REQUESTED', 'STARTING', 'RECORDING', 'STOPPING', 'PROCESSING');

create table if not exists public.publisher_replays (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  recording_id uuid not null references public.publisher_recordings(id) on delete cascade,
  publisher_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  visibility text not null default 'PRIVATE'
    check (visibility in ('PUBLIC', 'UNLISTED', 'PRIVATE')),
  status text not null default 'DRAFT'
    check (status in (
      'DRAFT', 'PROCESSING', 'READY', 'PUBLISHED', 'UNLISTED', 'PRIVATE',
      'ARCHIVED', 'TAKEDOWN', 'DELETED'
    )),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  thumbnail_storage_bucket text,
  thumbnail_storage_path text,
  published_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  moderation_state text not null default 'VISIBLE'
    check (moderation_state in ('VISIBLE', 'RESTRICTED', 'TAKEDOWN', 'DELETED')),
  moderation_reason text,
  moderated_by uuid references public.profiles(id) on delete set null,
  moderated_at timestamptz,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists publisher_replays_recording_uidx
  on public.publisher_replays (recording_id);

create index if not exists publisher_replays_publisher_idx
  on public.publisher_replays (publisher_user_id, created_at desc);

create index if not exists publisher_replays_visibility_idx
  on public.publisher_replays (visibility, status, published_at desc)
  where deleted_at is null and moderation_state = 'VISIBLE';

create table if not exists public.publisher_media_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  stream_id uuid references public.publisher_streams(id) on delete set null,
  recording_id uuid references public.publisher_recordings(id) on delete set null,
  replay_id uuid references public.publisher_replays(id) on delete set null,
  clip_id uuid,
  actor_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists publisher_media_audit_created_idx
  on public.publisher_media_audit_events (created_at desc);

comment on table public.publisher_recordings is
  'Live stream recording lifecycle. Storage paths server-generated. RETENTION_POLICY_PENDING.';
comment on table public.publisher_replays is
  'Replay metadata for publisher archive/playback. Storage access via signed RPC only.';
comment on table public.publisher_media_audit_events is
  'Recording/replay/clip audit. Must not store signed URLs or secrets.';

alter table public.publisher_recordings enable row level security;
alter table public.publisher_replays enable row level security;
alter table public.publisher_media_audit_events enable row level security;

revoke all on table public.publisher_recordings from public, anon, authenticated;
revoke all on table public.publisher_replays from public, anon, authenticated;
revoke all on table public.publisher_media_audit_events from public, anon, authenticated;

grant all on table public.publisher_recordings to service_role;
grant all on table public.publisher_replays to service_role;
grant all on table public.publisher_media_audit_events to service_role;

-- Owner may SELECT own metadata only (never mutate status/storage directly).
create policy publisher_recordings_owner_select
  on public.publisher_recordings for select to authenticated
  using (publisher_user_id = auth.uid() and status <> 'DELETED');

create policy publisher_replays_owner_select
  on public.publisher_replays for select to authenticated
  using (
    publisher_user_id = auth.uid()
    and deleted_at is null
    and moderation_state <> 'DELETED'
  );

create policy publisher_replays_public_select
  on public.publisher_replays for select to authenticated
  using (
    visibility = 'PUBLIC'
    and status = 'PUBLISHED'
    and deleted_at is null
    and moderation_state = 'VISIBLE'
    and internal_test = false
  );

create or replace function public.publisher_media_append_audit(
  target_event_type text,
  target_stream_id uuid,
  target_recording_id uuid,
  target_replay_id uuid,
  target_clip_id uuid,
  target_actor uuid,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.publisher_media_audit_events (
    event_type, stream_id, recording_id, replay_id, clip_id, actor_user_id, metadata
  ) values (
    target_event_type, target_stream_id, target_recording_id, target_replay_id, target_clip_id,
    target_actor,
    coalesce(target_metadata, '{}'::jsonb)
      - 'signed_url' - 'token' - 'secret' - 'api_secret' - 'service_role'
  );
end;
$$;

revoke all on function public.publisher_media_append_audit(text, uuid, uuid, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.publisher_media_append_audit(text, uuid, uuid, uuid, uuid, uuid, jsonb)
  to service_role;

create or replace function public.publisher_recording_active_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.publisher_recordings
  where status in ('REQUESTED', 'STARTING', 'RECORDING', 'STOPPING', 'PROCESSING');
$$;

create or replace function public.request_publisher_stream_recording(
  target_stream_id uuid,
  client_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  existing public.publisher_recordings%rowtype;
  result_row public.publisher_recordings%rowtype;
  active_global integer;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row from public.publisher_streams where id = target_stream_id for update;
  if not found then
    raise exception 'STREAM_NOT_FOUND';
  end if;
  if stream_row.owner_user_id is distinct from actor then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if stream_row.status not in ('live', 'reconnecting') then
    raise exception 'STREAM_NOT_LIVE';
  end if;
  if not stream_row.recording_enabled then
    raise exception 'RECORDING_NOT_ENABLED';
  end if;

  select * into existing
  from public.publisher_recordings r
  where r.stream_id = target_stream_id
    and r.status in ('REQUESTED', 'STARTING', 'RECORDING', 'STOPPING', 'PROCESSING')
  limit 1;
  if found then
    return jsonb_build_object(
      'recording_id', existing.id,
      'status', existing.status,
      'already_active', true
    );
  end if;

  active_global := public.publisher_recording_active_count();
  if active_global >= 1 then
    raise exception 'RECORDING_CAPACITY_EXCEEDED';
  end if;

  insert into public.publisher_recordings (
    stream_id, publisher_user_id, status, source_type, started_at
  ) values (
    target_stream_id, actor, 'REQUESTED', stream_row.ingest_mode, now()
  )
  returning * into result_row;

  perform public.publisher_media_append_audit(
    'RECORDING_STARTED', target_stream_id, result_row.id, null, null, actor,
    jsonb_build_object('client_request_id', client_request_id)
  );

  return jsonb_build_object(
    'recording_id', result_row.id,
    'status', result_row.status,
    'already_active', false,
    'room_name', stream_row.room_name,
    'provider_required', true
  );
end;
$$;

create or replace function public.request_stop_publisher_stream_recording(
  target_stream_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  rec public.publisher_recordings%rowtype;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into stream_row from public.publisher_streams where id = target_stream_id;
  if not found then
    raise exception 'STREAM_NOT_FOUND';
  end if;
  if stream_row.owner_user_id is distinct from actor then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select * into rec
  from public.publisher_recordings
  where stream_id = target_stream_id
    and status in ('REQUESTED', 'STARTING', 'RECORDING')
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', true, 'stopped', false);
  end if;

  update public.publisher_recordings
  set status = case when status = 'REQUESTED' then 'CANCELLED' else 'STOPPING' end,
      updated_at = now()
  where id = rec.id
  returning * into rec;

  perform public.publisher_media_append_audit(
    'RECORDING_STOPPED', target_stream_id, rec.id, null, null, actor, '{}'::jsonb
  );

  return jsonb_build_object(
    'ok', true,
    'stopped', true,
    'recording_id', rec.id,
    'status', rec.status,
    'provider_egress_id', rec.provider_egress_id
  );
end;
$$;

create or replace function public.set_publisher_stream_recording_enabled(
  target_stream_id uuid,
  target_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  update public.publisher_streams
  set recording_enabled = coalesce(target_enabled, false), updated_at = now()
  where id = target_stream_id and owner_user_id = actor
  returning * into stream_row;
  if not found then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  return jsonb_build_object('stream_id', stream_row.id, 'recording_enabled', stream_row.recording_enabled);
end;
$$;

create or replace function public.list_my_publisher_replays(
  status_filter text default null,
  visibility_filter text default null,
  page_limit integer default 40,
  page_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  lim integer := greatest(1, least(coalesce(page_limit, 40), 100));
  off integer := greatest(0, coalesce(page_offset, 0));
  result jsonb;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if status_filter is not null and status_filter not in (
    'DRAFT', 'PROCESSING', 'READY', 'PUBLISHED', 'UNLISTED', 'PRIVATE', 'ARCHIVED', 'TAKEDOWN', 'DELETED'
  ) then
    raise exception 'STATUS_INVALID';
  end if;
  if visibility_filter is not null and visibility_filter not in ('PUBLIC', 'UNLISTED', 'PRIVATE') then
    raise exception 'VISIBILITY_INVALID';
  end if;

  select coalesce(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb)
  into result
  from (
    select
      r.id,
      r.stream_id,
      r.recording_id,
      r.title,
      r.description,
      r.visibility,
      r.status,
      r.duration_ms,
      r.published_at,
      r.archived_at,
      r.moderation_state,
      r.created_at,
      r.updated_at,
      rec.status as recording_status,
      rec.processing_state,
      rec.size_bytes,
      rec.failure_code
    from public.publisher_replays r
    join public.publisher_recordings rec on rec.id = r.recording_id
    where r.publisher_user_id = actor
      and r.deleted_at is null
      and (status_filter is null or r.status = status_filter)
      and (visibility_filter is null or r.visibility = visibility_filter)
    order by r.created_at desc
    limit lim offset off
  ) q;

  return jsonb_build_object('items', result, 'limit', lim, 'offset', off);
end;
$$;

create or replace function public.update_my_publisher_replay(
  target_replay_id uuid,
  target_title text default null,
  target_description text default null,
  target_visibility text default null,
  target_action text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  replay_row public.publisher_replays%rowtype;
  next_status text;
  next_visibility text;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into replay_row from public.publisher_replays where id = target_replay_id for update;
  if not found or replay_row.publisher_user_id is distinct from actor then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if replay_row.moderation_state in ('TAKEDOWN', 'DELETED') or replay_row.deleted_at is not null then
    raise exception 'REPLAY_LOCKED';
  end if;

  next_visibility := coalesce(nullif(target_visibility, ''), replay_row.visibility);
  if next_visibility not in ('PUBLIC', 'UNLISTED', 'PRIVATE') then
    raise exception 'VISIBILITY_INVALID';
  end if;

  next_status := replay_row.status;
  if target_action = 'publish' then
    if replay_row.status not in ('READY', 'PRIVATE', 'UNLISTED', 'PUBLISHED') then
      raise exception 'REPLAY_NOT_READY';
    end if;
    next_status := case next_visibility
      when 'PUBLIC' then 'PUBLISHED'
      when 'UNLISTED' then 'UNLISTED'
      else 'PRIVATE'
    end;
  elsif target_action = 'archive' then
    next_status := 'ARCHIVED';
  elsif target_action = 'delete' then
    next_status := 'DELETED';
  end if;

  update public.publisher_replays
  set
    title = coalesce(nullif(btrim(target_title), ''), title),
    description = coalesce(target_description, description),
    visibility = next_visibility,
    status = next_status,
    published_at = case when target_action = 'publish' then coalesce(published_at, now()) else published_at end,
    archived_at = case when target_action = 'archive' then now() else archived_at end,
    deleted_at = case when target_action = 'delete' then now() else deleted_at end,
    updated_at = now()
  where id = target_replay_id
  returning * into replay_row;

  perform public.publisher_media_append_audit(
    case
      when target_action = 'publish' then 'REPLAY_PUBLISHED'
      when target_action = 'archive' then 'REPLAY_ARCHIVED'
      when target_action = 'delete' then 'REPLAY_DELETED'
      else 'REPLAY_VISIBILITY_CHANGED'
    end,
    replay_row.stream_id, replay_row.recording_id, replay_row.id, null, actor,
    jsonb_build_object('visibility', replay_row.visibility, 'status', replay_row.status)
  );

  return jsonb_build_object(
    'id', replay_row.id,
    'status', replay_row.status,
    'visibility', replay_row.visibility
  );
end;
$$;

revoke all on function public.request_publisher_stream_recording(uuid, uuid) from public, anon;
revoke all on function public.request_stop_publisher_stream_recording(uuid) from public, anon;
revoke all on function public.set_publisher_stream_recording_enabled(uuid, boolean) from public, anon;
revoke all on function public.list_my_publisher_replays(text, text, integer, integer) from public, anon;
revoke all on function public.update_my_publisher_replay(uuid, text, text, text, text) from public, anon;
revoke all on function public.publisher_recording_active_count() from public, anon, authenticated;

grant execute on function public.request_publisher_stream_recording(uuid, uuid) to authenticated;
grant execute on function public.request_stop_publisher_stream_recording(uuid) to authenticated;
grant execute on function public.set_publisher_stream_recording_enabled(uuid, boolean) to authenticated;
grant execute on function public.list_my_publisher_replays(text, text, integer, integer) to authenticated;
grant execute on function public.update_my_publisher_replay(uuid, text, text, text, text) to authenticated;
grant execute on function public.publisher_recording_active_count() to service_role;

commit;
