-- Publisher stream management: lifecycle, hashed OBS/external credentials, audit, rate limits.
-- EXTENDS Live Now / Go Live — does NOT replace community_live_screen_sessions.
-- Forward-only. Plaintext stream keys are never persisted.
-- Production: set app.settings.livekit_rtmp_url (or override ingest_url from edge) before OBS ingest goes live.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1) publisher_streams
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_streams (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  -- publisher_profiles is keyed by user_id (no separate id column).
  publisher_profile_id uuid references public.publisher_profiles(user_id) on delete set null,
  schedule_id uuid references public.publisher_stream_schedules(id) on delete set null,
  live_session_id uuid references public.community_live_screen_sessions(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'other' check (char_length(category) <= 64),
  tags text[] not null default '{}',
  cover_storage_path text,
  visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  moderation_mode text not null default 'standard'
    check (moderation_mode in ('standard', 'strict', 'relaxed')),
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'draft'
    check (status in (
      'draft', 'scheduled', 'ready', 'connecting', 'live', 'reconnecting',
      'ending', 'ended', 'cancelled', 'failed'
    )),
  ingest_mode text not null default 'PICOM_NATIVE'
    check (ingest_mode in ('PICOM_NATIVE', 'OBS_EXTERNAL')),
  room_name text,
  connection_state text not null default 'NOT_CONNECTED'
    check (connection_state in (
      'NOT_CONNECTED', 'WAITING', 'CONNECTED', 'PUBLISHING',
      'UNHEALTHY', 'DISCONNECTED', 'REVOKED'
    )),
  health_status text not null default 'DISCONNECTED'
    check (health_status in ('EXCELLENT', 'GOOD', 'DEGRADED', 'POOR', 'DISCONNECTED')),
  client_request_id uuid,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publisher_streams_owner_status_idx
  on public.publisher_streams (owner_user_id, status);

create unique index if not exists publisher_streams_client_request_uidx
  on public.publisher_streams (client_request_id)
  where client_request_id is not null;

create unique index if not exists publisher_streams_one_active_per_owner_uidx
  on public.publisher_streams (owner_user_id)
  where status in ('connecting', 'live', 'reconnecting', 'ending');

create index if not exists publisher_streams_live_session_idx
  on public.publisher_streams (live_session_id)
  where live_session_id is not null;

comment on table public.publisher_streams is
  'Publisher-owned stream lifecycle records. Extends Live Now; discovery remains on community_live_screen_sessions.';

comment on column public.publisher_streams.live_session_id is
  'Optional link to community_live_screen_sessions for PICOM_NATIVE / Go Live discovery.';

comment on column public.publisher_streams.ingest_mode is
  'PICOM_NATIVE = WebRTC Go Live path; OBS_EXTERNAL = hashed RTMP/WHIP credentials via LiveKit Ingress when deployed.';

-- ---------------------------------------------------------------------------
-- 2) publisher_stream_credentials (hashed secrets only)
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_stream_credentials (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  credential_prefix text not null check (char_length(credential_prefix) between 4 and 32),
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  provider_ingress_id text,
  provider_room_name text,
  ingest_url text,
  protocol text not null default 'RTMP'
    check (protocol in ('RTMP', 'RTMPS', 'WHIP')),
  status text not null default 'active'
    check (status in ('active', 'rotated', 'revoked')),
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  last_tested_at timestamptz
);

create unique index if not exists publisher_stream_credentials_one_active_uidx
  on public.publisher_stream_credentials (stream_id)
  where status = 'active';

create index if not exists publisher_stream_credentials_owner_idx
  on public.publisher_stream_credentials (owner_user_id, status);

create index if not exists publisher_stream_credentials_prefix_idx
  on public.publisher_stream_credentials (credential_prefix);

comment on table public.publisher_stream_credentials is
  'OBS/external ingest credentials. Stores sha256 hex of raw secret only — plaintext is returned once at create/rotate.';

comment on column public.publisher_stream_credentials.ingest_url is
  'Server URL only (no stream key). Production must set app.settings.livekit_rtmp_url or edge override; default is a placeholder until ingress is deployed.';

comment on column public.publisher_stream_credentials.secret_hash is
  'encode(extensions.digest(convert_to(raw_secret, ''UTF8''), ''sha256''), ''hex''). Never store plaintext.';

-- ---------------------------------------------------------------------------
-- 3) publisher_stream_audit_events
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_stream_audit_events (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null
    check (event_type in (
      'STREAM_CREATED',
      'STREAM_UPDATED',
      'STREAM_SCHEDULED',
      'STREAM_CANCELLED',
      'STREAM_CREDENTIAL_CREATED',
      'STREAM_CREDENTIAL_ROTATED',
      'STREAM_CREDENTIAL_REVOKED',
      'STREAM_CONNECTION_TEST',
      'STREAM_STARTED',
      'STREAM_RECONNECTED',
      'STREAM_ENDED',
      'STREAM_FAILED',
      'STREAM_TERMINATED_BY_ROOT',
      'STREAM_TRANSITION'
    )),
  from_status text,
  to_status text,
  reason text check (reason is null or char_length(reason) <= 2000),
  correlation_id text check (correlation_id is null or char_length(correlation_id) <= 120),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists publisher_stream_audit_stream_created_idx
  on public.publisher_stream_audit_events (stream_id, created_at desc);

create index if not exists publisher_stream_audit_actor_idx
  on public.publisher_stream_audit_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

comment on table public.publisher_stream_audit_events is
  'Append-only publisher stream audit trail. Must never contain plaintext stream keys or secrets.';

-- ---------------------------------------------------------------------------
-- 4) publisher_stream_rate_limits
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_stream_rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null
    check (action in (
      'stream_create',
      'credential_create',
      'credential_rotate',
      'connection_test',
      'start_broadcast',
      'reconnect'
    )),
  window_started_at timestamptz not null,
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now(),
  unique (user_id, action, window_started_at)
);

create index if not exists publisher_stream_rate_limits_updated_idx
  on public.publisher_stream_rate_limits (updated_at);

comment on table public.publisher_stream_rate_limits is
  'Content-free anti-abuse counters for publisher stream RPCs. No secrets or stream payloads.';

-- ---------------------------------------------------------------------------
-- RLS (default deny) — policies after helpers that policies may call
-- ---------------------------------------------------------------------------
alter table public.publisher_streams enable row level security;
alter table public.publisher_streams force row level security;
alter table public.publisher_stream_credentials enable row level security;
alter table public.publisher_stream_credentials force row level security;
alter table public.publisher_stream_audit_events enable row level security;
alter table public.publisher_stream_audit_events force row level security;
alter table public.publisher_stream_rate_limits enable row level security;
alter table public.publisher_stream_rate_limits force row level security;

revoke all on table public.publisher_streams from public, anon, authenticated;
revoke all on table public.publisher_stream_credentials from public, anon, authenticated;
revoke all on table public.publisher_stream_audit_events from public, anon, authenticated;
revoke all on table public.publisher_stream_rate_limits from public, anon, authenticated;

grant all on table public.publisher_streams to service_role;
grant all on table public.publisher_stream_credentials to service_role;
grant all on table public.publisher_stream_audit_events to service_role;
grant all on table public.publisher_stream_rate_limits to service_role;

-- ---------------------------------------------------------------------------
-- 5) Helpers
-- ---------------------------------------------------------------------------
create or replace function public.publisher_stream_is_owner(target_stream_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.publisher_streams s
    where s.id = target_stream_id
      and s.owner_user_id = auth.uid()
  );
$$;

revoke all on function public.publisher_stream_is_owner(uuid) from public, anon;
grant execute on function public.publisher_stream_is_owner(uuid) to authenticated, service_role;

create or replace function public.publisher_stream_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    auth.uid() is not null
    and public.user_can_broadcast_on_picom_live(auth.uid()),
    false
  );
$$;

revoke all on function public.publisher_stream_can_manage() from public, anon;
grant execute on function public.publisher_stream_can_manage() to authenticated, service_role;

-- Lifecycle transition matrix:
-- draft       -> scheduled | ready | cancelled
-- scheduled   -> draft | ready | cancelled
-- ready       -> connecting | scheduled | draft | cancelled
-- connecting  -> live | failed | ending
-- live        -> reconnecting | ending | failed
-- reconnecting-> live | ending | failed
-- ending      -> ended | failed
-- ended | cancelled | failed -> (terminal)
create or replace function public.publisher_stream_transition_allowed(
  from_status text,
  to_status text
)
returns boolean
language sql
immutable
as $$
  select case
    when from_status is null or to_status is null then false
    when from_status = to_status then false
    when from_status = 'draft' then to_status in ('scheduled', 'ready', 'cancelled')
    when from_status = 'scheduled' then to_status in ('draft', 'ready', 'cancelled')
    when from_status = 'ready' then to_status in ('connecting', 'scheduled', 'draft', 'cancelled')
    when from_status = 'connecting' then to_status in ('live', 'failed', 'ending')
    when from_status = 'live' then to_status in ('reconnecting', 'ending', 'failed')
    when from_status = 'reconnecting' then to_status in ('live', 'ending', 'failed')
    when from_status = 'ending' then to_status in ('ended', 'failed')
    else false
  end;
$$;

revoke all on function public.publisher_stream_transition_allowed(text, text) from public, anon;
grant execute on function public.publisher_stream_transition_allowed(text, text) to authenticated, service_role;

create or replace function public.publisher_stream_append_audit(
  target_stream_id uuid,
  target_actor_user_id uuid,
  target_event_type text,
  target_from_status text default null,
  target_to_status text default null,
  target_reason text default null,
  target_correlation_id text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_id uuid;
  safe_metadata jsonb := coalesce(target_metadata, '{}'::jsonb);
begin
  if jsonb_typeof(safe_metadata) is distinct from 'object' then
    raise exception 'STREAM_AUDIT_METADATA_INVALID' using errcode = '22023';
  end if;
  -- Never persist common secret-bearing keys if callers pass them by mistake.
  safe_metadata := safe_metadata
    - 'plaintext_secret'
    - 'secret'
    - 'stream_key'
    - 'streamKey'
    - 'raw_secret';

  insert into public.publisher_stream_audit_events (
    stream_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    reason,
    correlation_id,
    metadata
  ) values (
    target_stream_id,
    target_actor_user_id,
    target_event_type,
    target_from_status,
    target_to_status,
    nullif(left(btrim(coalesce(target_reason, '')), 2000), ''),
    nullif(left(btrim(coalesce(target_correlation_id, '')), 120), ''),
    safe_metadata
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.publisher_stream_append_audit(uuid, uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.publisher_stream_append_audit(uuid, uuid, text, text, text, text, text, jsonb)
  to service_role;

create or replace function public.consume_publisher_stream_rate_limit(
  target_user_id uuid,
  target_action text,
  max_attempts integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  window_start timestamptz;
  next_attempts integer;
begin
  if target_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_action not in (
    'stream_create', 'credential_create', 'credential_rotate',
    'connection_test', 'start_broadcast', 'reconnect'
  ) then
    raise exception 'STREAM_RATE_LIMIT_ACTION_INVALID' using errcode = '22023';
  end if;
  if max_attempts < 1 or window_seconds not between 10 and 86400 then
    raise exception 'STREAM_RATE_LIMIT_INVALID' using errcode = '22023';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from now()) / window_seconds) * window_seconds
  );

  insert into public.publisher_stream_rate_limits (user_id, action, window_started_at, attempts)
  values (target_user_id, target_action, window_start, 1)
  on conflict (user_id, action, window_started_at)
  do update set
    attempts = public.publisher_stream_rate_limits.attempts + 1,
    updated_at = now()
  returning attempts into next_attempts;

  delete from public.publisher_stream_rate_limits
  where updated_at < now() - interval '24 hours';

  return next_attempts <= max_attempts;
end;
$$;

revoke all on function public.consume_publisher_stream_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_publisher_stream_rate_limit(uuid, text, integer, integer)
  to service_role;

create or replace function public.publisher_stream_normalize_title(raw text)
returns text
language sql
immutable
as $$
  select left(
    btrim(regexp_replace(coalesce(raw, ''), E'[\\u0000-\\u001f\\u007f]', '', 'g')),
    160
  );
$$;

revoke all on function public.publisher_stream_normalize_title(text) from public, anon;
grant execute on function public.publisher_stream_normalize_title(text) to authenticated, service_role;

create or replace function public.publisher_stream_ingest_url()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  configured text;
begin
  -- Production must set this GUC (or edge must override ingest_url) once LiveKit Ingress RTMP is deployed.
  begin
    configured := nullif(btrim(current_setting('app.settings.livekit_rtmp_url', true)), '');
  exception when others then
    configured := null;
  end;
  return coalesce(configured, 'rtmp://ingest.picom.gg/live');
end;
$$;

revoke all on function public.publisher_stream_ingest_url() from public, anon, authenticated;
grant execute on function public.publisher_stream_ingest_url() to service_role;

create or replace function public.publisher_stream_hash_secret(raw_secret text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(convert_to(raw_secret, 'UTF8'), 'sha256'), 'hex');
$$;

revoke all on function public.publisher_stream_hash_secret(text) from public, anon, authenticated;
grant execute on function public.publisher_stream_hash_secret(text) to service_role;

create or replace function public.publisher_stream_audit_event_for_transition(to_status text)
returns text
language sql
immutable
as $$
  select case to_status
    when 'live' then 'STREAM_STARTED'
    when 'reconnecting' then 'STREAM_RECONNECTED'
    when 'ended' then 'STREAM_ENDED'
    when 'failed' then 'STREAM_FAILED'
    when 'cancelled' then 'STREAM_CANCELLED'
    when 'scheduled' then 'STREAM_SCHEDULED'
    else 'STREAM_TRANSITION'
  end;
$$;

revoke all on function public.publisher_stream_audit_event_for_transition(text) from public, anon;
grant execute on function public.publisher_stream_audit_event_for_transition(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_publisher_stream(
  target_title text,
  target_description text default '',
  target_category text default 'other',
  target_tags text[] default '{}',
  target_visibility text default 'public',
  target_ingest_mode text default 'PICOM_NATIVE',
  target_scheduled_at timestamptz default null,
  target_moderation_mode text default 'standard',
  target_client_request_id uuid default null
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  existing public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
  normalized_title text := public.publisher_stream_normalize_title(target_title);
  normalized_description text := left(
    btrim(regexp_replace(coalesce(target_description, ''), E'[\\u0000-\\u001f\\u007f]', '', 'g')),
    2000
  );
  normalized_category text := left(btrim(coalesce(nullif(target_category, ''), 'other')), 64);
  normalized_visibility text := case
    when target_visibility in ('public', 'unlisted', 'private') then target_visibility
    else 'public'
  end;
  normalized_ingest text := case
    when target_ingest_mode in ('PICOM_NATIVE', 'OBS_EXTERNAL') then target_ingest_mode
    else 'PICOM_NATIVE'
  end;
  normalized_moderation text := case
    when target_moderation_mode in ('standard', 'strict', 'relaxed') then target_moderation_mode
    else 'standard'
  end;
  initial_status text;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;
  if char_length(normalized_title) < 2 then
    raise exception 'STREAM_TITLE_INVALID' using errcode = '22023';
  end if;

  if target_client_request_id is not null then
    select * into existing
    from public.publisher_streams
    where client_request_id = target_client_request_id
    limit 1;
    if found then
      if existing.owner_user_id <> actor_id then
        raise exception 'STREAM_CLIENT_REQUEST_CONFLICT' using errcode = '42501';
      end if;
      return existing;
    end if;
  end if;

  if not public.consume_publisher_stream_rate_limit(actor_id, 'stream_create', 20, 3600) then
    raise exception 'STREAM_CREATE_RATE_LIMITED' using errcode = '54000';
  end if;

  initial_status := case when target_scheduled_at is not null then 'scheduled' else 'draft' end;

  insert into public.publisher_streams (
    owner_user_id,
    publisher_profile_id,
    title,
    description,
    category,
    tags,
    visibility,
    moderation_mode,
    scheduled_at,
    status,
    ingest_mode,
    client_request_id
  ) values (
    actor_id,
    case
      when exists (
        select 1 from public.publisher_profiles p
        where p.user_id = actor_id and p.status = 'active'
      ) then actor_id
      else null
    end,
    normalized_title,
    normalized_description,
    normalized_category,
    coalesce(target_tags, '{}'),
    normalized_visibility,
    normalized_moderation,
    target_scheduled_at,
    initial_status,
    normalized_ingest,
    target_client_request_id
  )
  returning * into result_row;

  perform public.publisher_stream_append_audit(
    result_row.id,
    actor_id,
    'STREAM_CREATED',
    null,
    result_row.status,
    null,
    null,
    jsonb_build_object(
      'ingest_mode', result_row.ingest_mode,
      'visibility', result_row.visibility,
      'client_request_id', result_row.client_request_id
    )
  );

  return result_row;
end;
$$;

revoke all on function public.create_publisher_stream(text, text, text, text[], text, text, timestamptz, text, uuid)
  from public, anon;
grant execute on function public.create_publisher_stream(text, text, text, text[], text, text, timestamptz, text, uuid)
  to authenticated;

create or replace function public.update_publisher_stream(
  target_stream_id uuid,
  target_title text default null,
  target_description text default null,
  target_category text default null,
  target_tags text[] default null,
  target_visibility text default null,
  target_moderation_mode text default null,
  target_scheduled_at timestamptz default null,
  target_cover_storage_path text default null,
  target_clear_cover boolean default false
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if stream_row.status not in ('draft', 'scheduled', 'ready') then
    raise exception 'STREAM_NOT_EDITABLE' using errcode = '55000';
  end if;

  if target_title is not null
     and char_length(public.publisher_stream_normalize_title(target_title)) < 2 then
    raise exception 'STREAM_TITLE_INVALID' using errcode = '22023';
  end if;

  update public.publisher_streams
  set
    title = case
      when target_title is null then title
      else public.publisher_stream_normalize_title(target_title)
    end,
    description = case
      when target_description is null then description
      else left(
        btrim(regexp_replace(target_description, E'[\\u0000-\\u001f\\u007f]', '', 'g')),
        2000
      )
    end,
    category = case
      when target_category is null then category
      else left(btrim(coalesce(nullif(target_category, ''), category)), 64)
    end,
    tags = coalesce(target_tags, tags),
    visibility = case
      when target_visibility in ('public', 'unlisted', 'private') then target_visibility
      else visibility
    end,
    moderation_mode = case
      when target_moderation_mode in ('standard', 'strict', 'relaxed') then target_moderation_mode
      else moderation_mode
    end,
    scheduled_at = coalesce(target_scheduled_at, scheduled_at),
    cover_storage_path = case
      when coalesce(target_clear_cover, false) then null
      when target_cover_storage_path is null then cover_storage_path
      else nullif(btrim(target_cover_storage_path), '')
    end,
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  perform public.publisher_stream_append_audit(
    result_row.id,
    actor_id,
    'STREAM_UPDATED',
    stream_row.status,
    result_row.status,
    null,
    null,
    jsonb_build_object('fields', 'metadata')
  );

  return result_row;
end;
$$;

revoke all on function public.update_publisher_stream(uuid, text, text, text, text[], text, text, timestamptz, text, boolean)
  from public, anon;
grant execute on function public.update_publisher_stream(uuid, text, text, text, text[], text, text, timestamptz, text, boolean)
  to authenticated;

create or replace function public.transition_publisher_stream(
  target_stream_id uuid,
  target_to_status text,
  target_reason text default null,
  target_correlation_id text default null
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  is_service boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
  event_type text;
begin
  if not is_service and actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not is_service then
    if stream_row.owner_user_id <> actor_id then
      raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
    end if;
    if not public.publisher_stream_can_manage() then
      raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
    end if;
  end if;

  if target_to_status not in (
    'draft', 'scheduled', 'ready', 'connecting', 'live', 'reconnecting',
    'ending', 'ended', 'cancelled', 'failed'
  ) then
    raise exception 'STREAM_STATUS_INVALID' using errcode = '22023';
  end if;

  if not public.publisher_stream_transition_allowed(stream_row.status, target_to_status) then
    raise exception 'STREAM_TRANSITION_DENIED' using errcode = '55000';
  end if;

  if target_to_status = 'connecting' and actor_id is not null then
    if not public.consume_publisher_stream_rate_limit(actor_id, 'start_broadcast', 20, 3600) then
      raise exception 'STREAM_START_RATE_LIMITED' using errcode = '54000';
    end if;
  end if;
  if target_to_status = 'reconnecting' and actor_id is not null then
    if not public.consume_publisher_stream_rate_limit(actor_id, 'reconnect', 60, 3600) then
      raise exception 'STREAM_RECONNECT_RATE_LIMITED' using errcode = '54000';
    end if;
  end if;

  update public.publisher_streams
  set
    status = target_to_status,
    started_at = case
      when target_to_status = 'live' then coalesce(started_at, now())
      else started_at
    end,
    ended_at = case
      when target_to_status in ('ended', 'cancelled', 'failed') then coalesce(ended_at, now())
      else ended_at
    end,
    connection_state = case
      when target_to_status = 'connecting' then 'WAITING'
      when target_to_status = 'live' then 'PUBLISHING'
      when target_to_status = 'reconnecting' then 'UNHEALTHY'
      when target_to_status = 'ending' then 'DISCONNECTED'
      when target_to_status in ('ended', 'cancelled', 'failed') then 'DISCONNECTED'
      else connection_state
    end,
    health_status = case
      when target_to_status = 'live' then 'GOOD'
      when target_to_status = 'reconnecting' then 'DEGRADED'
      when target_to_status in ('ending', 'ended', 'cancelled', 'failed') then 'DISCONNECTED'
      else health_status
    end,
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  event_type := public.publisher_stream_audit_event_for_transition(target_to_status);

  perform public.publisher_stream_append_audit(
    result_row.id,
    actor_id,
    event_type,
    stream_row.status,
    result_row.status,
    target_reason,
    target_correlation_id,
    jsonb_build_object('via', case when is_service then 'service_role' else 'owner' end)
  );

  return result_row;
end;
$$;

revoke all on function public.transition_publisher_stream(uuid, text, text, text) from public, anon;
grant execute on function public.transition_publisher_stream(uuid, text, text, text) to authenticated, service_role;

create or replace function public.schedule_publisher_stream(
  target_stream_id uuid,
  target_scheduled_at timestamptz
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_scheduled_at is null then
    raise exception 'STREAM_SCHEDULE_REQUIRED' using errcode = '22023';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;
  if stream_row.status not in ('draft', 'ready') then
    raise exception 'STREAM_SCHEDULE_STATUS_INVALID' using errcode = '55000';
  end if;
  if not public.publisher_stream_transition_allowed(stream_row.status, 'scheduled') then
    raise exception 'STREAM_TRANSITION_DENIED' using errcode = '55000';
  end if;

  update public.publisher_streams
  set
    scheduled_at = target_scheduled_at,
    status = 'scheduled',
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  perform public.publisher_stream_append_audit(
    result_row.id,
    actor_id,
    'STREAM_SCHEDULED',
    stream_row.status,
    'scheduled',
    null,
    null,
    jsonb_build_object('scheduled_at', result_row.scheduled_at)
  );

  return result_row;
end;
$$;

revoke all on function public.schedule_publisher_stream(uuid, timestamptz) from public, anon;
grant execute on function public.schedule_publisher_stream(uuid, timestamptz) to authenticated;

create or replace function public.cancel_publisher_stream(
  target_stream_id uuid,
  target_reason text default null
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.transition_publisher_stream(
    target_stream_id,
    'cancelled',
    target_reason,
    null
  );
end;
$$;

revoke all on function public.cancel_publisher_stream(uuid, text) from public, anon;
grant execute on function public.cancel_publisher_stream(uuid, text) to authenticated;

create or replace function public.prepare_publisher_stream(target_stream_id uuid)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;
  if stream_row.status not in ('draft', 'scheduled') then
    raise exception 'STREAM_PREPARE_STATUS_INVALID' using errcode = '55000';
  end if;
  if not public.publisher_stream_transition_allowed(stream_row.status, 'ready') then
    raise exception 'STREAM_TRANSITION_DENIED' using errcode = '55000';
  end if;

  update public.publisher_streams
  set
    status = 'ready',
    room_name = coalesce(
      room_name,
      'publisher-stream:' || id::text
    ),
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  perform public.publisher_stream_append_audit(
    result_row.id,
    actor_id,
    'STREAM_TRANSITION',
    stream_row.status,
    'ready',
    null,
    null,
    jsonb_build_object('action', 'prepare')
  );

  return result_row;
end;
$$;

revoke all on function public.prepare_publisher_stream(uuid) from public, anon;
grant execute on function public.prepare_publisher_stream(uuid) to authenticated;

create or replace function public.create_publisher_stream_credential(target_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  cred_id uuid;
  random_hex text;
  raw_secret text;
  secret_prefix text;
  ingest text;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;
  if stream_row.ingest_mode <> 'OBS_EXTERNAL' then
    raise exception 'STREAM_CREDENTIAL_OBS_ONLY' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.publisher_stream_credentials c
    where c.stream_id = target_stream_id and c.status = 'active'
  ) then
    raise exception 'STREAM_CREDENTIAL_ACTIVE_EXISTS' using errcode = '23505';
  end if;

  if not public.consume_publisher_stream_rate_limit(actor_id, 'credential_create', 10, 3600) then
    raise exception 'STREAM_CREDENTIAL_CREATE_RATE_LIMITED' using errcode = '54000';
  end if;

  random_hex := encode(extensions.gen_random_bytes(32), 'hex');
  raw_secret := 'pk_live_' || random_hex;
  secret_prefix := left(random_hex, 8);
  ingest := public.publisher_stream_ingest_url();

  insert into public.publisher_stream_credentials (
    stream_id,
    owner_user_id,
    credential_prefix,
    secret_hash,
    ingest_url,
    protocol,
    status
  ) values (
    target_stream_id,
    actor_id,
    secret_prefix,
    public.publisher_stream_hash_secret(raw_secret),
    ingest,
    'RTMP',
    'active'
  )
  returning id into cred_id;

  update public.publisher_streams
  set
    connection_state = case
      when connection_state = 'NOT_CONNECTED' then 'WAITING'
      else connection_state
    end,
    updated_at = now()
  where id = target_stream_id;

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    'STREAM_CREDENTIAL_CREATED',
    stream_row.status,
    stream_row.status,
    null,
    null,
    jsonb_build_object(
      'credential_id', cred_id,
      'credential_prefix', secret_prefix,
      'protocol', 'RTMP'
    )
  );

  return jsonb_build_object(
    'credential_id', cred_id,
    'prefix', secret_prefix,
    'plaintext_secret', raw_secret,
    'ingest_url', ingest,
    'protocol', 'RTMP',
    'revealed_once', true
  );
end;
$$;

revoke all on function public.create_publisher_stream_credential(uuid) from public, anon;
grant execute on function public.create_publisher_stream_credential(uuid) to authenticated;

create or replace function public.rotate_publisher_stream_credential(target_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  old_cred public.publisher_stream_credentials%rowtype;
  cred_id uuid;
  random_hex text;
  raw_secret text;
  secret_prefix text;
  ingest text;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;
  if stream_row.ingest_mode <> 'OBS_EXTERNAL' then
    raise exception 'STREAM_CREDENTIAL_OBS_ONLY' using errcode = '55000';
  end if;

  if not public.consume_publisher_stream_rate_limit(actor_id, 'credential_rotate', 10, 3600) then
    raise exception 'STREAM_CREDENTIAL_ROTATE_RATE_LIMITED' using errcode = '54000';
  end if;

  update public.publisher_stream_credentials
  set
    status = 'rotated',
    rotated_at = now()
  where stream_id = target_stream_id
    and status = 'active'
  returning * into old_cred;

  random_hex := encode(extensions.gen_random_bytes(32), 'hex');
  raw_secret := 'pk_live_' || random_hex;
  secret_prefix := left(random_hex, 8);
  ingest := public.publisher_stream_ingest_url();

  insert into public.publisher_stream_credentials (
    stream_id,
    owner_user_id,
    credential_prefix,
    secret_hash,
    ingest_url,
    protocol,
    status,
    provider_room_name
  ) values (
    target_stream_id,
    actor_id,
    secret_prefix,
    public.publisher_stream_hash_secret(raw_secret),
    ingest,
    'RTMP',
    'active',
    coalesce(old_cred.provider_room_name, stream_row.room_name)
  )
  returning id into cred_id;

  update public.publisher_streams
  set updated_at = now()
  where id = target_stream_id;

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    'STREAM_CREDENTIAL_ROTATED',
    stream_row.status,
    stream_row.status,
    null,
    null,
    jsonb_build_object(
      'credential_id', cred_id,
      'previous_credential_id', old_cred.id,
      'credential_prefix', secret_prefix
    )
  );

  return jsonb_build_object(
    'credential_id', cred_id,
    'prefix', secret_prefix,
    'plaintext_secret', raw_secret,
    'ingest_url', ingest,
    'protocol', 'RTMP',
    'revealed_once', true
  );
end;
$$;

revoke all on function public.rotate_publisher_stream_credential(uuid) from public, anon;
grant execute on function public.rotate_publisher_stream_credential(uuid) to authenticated;

create or replace function public.revoke_publisher_stream_credential(target_stream_id uuid)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
  revoked_count integer;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;

  update public.publisher_stream_credentials
  set
    status = 'revoked',
    revoked_at = now()
  where stream_id = target_stream_id
    and status = 'active';
  get diagnostics revoked_count = row_count;

  if revoked_count = 0 then
    raise exception 'STREAM_CREDENTIAL_NOT_ACTIVE' using errcode = 'P0002';
  end if;

  update public.publisher_streams
  set
    connection_state = 'REVOKED',
    health_status = 'DISCONNECTED',
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    'STREAM_CREDENTIAL_REVOKED',
    stream_row.status,
    result_row.status,
    null,
    null,
    jsonb_build_object('connection_state', 'REVOKED')
  );

  return result_row;
end;
$$;

revoke all on function public.revoke_publisher_stream_credential(uuid) from public, anon;
grant execute on function public.revoke_publisher_stream_credential(uuid) to authenticated;

create or replace function public.test_publisher_stream_credential(target_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  cred_row public.publisher_stream_credentials%rowtype;
  tested_at timestamptz := now();
  next_state text;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;

  select * into cred_row
  from public.publisher_stream_credentials
  where stream_id = target_stream_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'STREAM_CREDENTIAL_NOT_ACTIVE' using errcode = 'P0002';
  end if;

  if not public.consume_publisher_stream_rate_limit(actor_id, 'connection_test', 30, 3600) then
    raise exception 'STREAM_CONNECTION_TEST_RATE_LIMITED' using errcode = '54000';
  end if;

  -- Does not return the key. Until ingress is wired, missing provider_ingress_id => WAITING.
  next_state := case
    when cred_row.provider_ingress_id is null then 'WAITING'
    else coalesce(nullif(stream_row.connection_state, 'NOT_CONNECTED'), 'WAITING')
  end;

  update public.publisher_stream_credentials
  set last_tested_at = tested_at
  where id = cred_row.id;

  update public.publisher_streams
  set
    connection_state = next_state,
    updated_at = tested_at
  where id = target_stream_id;

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    'STREAM_CONNECTION_TEST',
    stream_row.status,
    stream_row.status,
    null,
    null,
    jsonb_build_object(
      'connection_state', next_state,
      'provider_ingress_present', cred_row.provider_ingress_id is not null
    )
  );

  return jsonb_build_object(
    'connection_state', next_state,
    'tested_at', tested_at
  );
end;
$$;

revoke all on function public.test_publisher_stream_credential(uuid) from public, anon;
grant execute on function public.test_publisher_stream_credential(uuid) to authenticated;

create or replace function public.list_my_publisher_streams(
  status_filter text default null,
  target_limit integer default 40
)
returns setof public.publisher_streams
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  lim integer := greatest(1, least(coalesce(target_limit, 40), 100));
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if status_filter is not null and status_filter not in (
    'draft', 'scheduled', 'ready', 'connecting', 'live', 'reconnecting',
    'ending', 'ended', 'cancelled', 'failed'
  ) then
    raise exception 'STREAM_STATUS_INVALID' using errcode = '22023';
  end if;

  return query
  select s.*
  from public.publisher_streams s
  where s.owner_user_id = actor_id
    and (status_filter is null or s.status = status_filter)
  order by s.updated_at desc, s.created_at desc
  limit lim;
end;
$$;

revoke all on function public.list_my_publisher_streams(text, integer) from public, anon;
grant execute on function public.list_my_publisher_streams(text, integer) to authenticated;

create or replace function public.get_my_publisher_stream(target_stream_id uuid)
returns public.publisher_streams
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result_row public.publisher_streams%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into result_row
  from public.publisher_streams
  where id = target_stream_id
    and owner_user_id = actor_id;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  return result_row;
end;
$$;

revoke all on function public.get_my_publisher_stream(uuid) from public, anon;
grant execute on function public.get_my_publisher_stream(uuid) to authenticated;

create or replace function public.link_publisher_stream_live_session(
  target_stream_id uuid,
  target_live_session_id uuid
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  session_row public.community_live_screen_sessions%rowtype;
  result_row public.publisher_streams%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;

  select * into session_row
  from public.community_live_screen_sessions
  where id = target_live_session_id;

  if not found then
    raise exception 'LIVE_SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if session_row.broadcaster_user_id <> actor_id then
    raise exception 'LIVE_SESSION_OWNER_MISMATCH' using errcode = '42501';
  end if;

  update public.publisher_streams
  set
    live_session_id = target_live_session_id,
    room_name = coalesce(room_name, session_row.livekit_room_name),
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    'STREAM_UPDATED',
    stream_row.status,
    result_row.status,
    null,
    null,
    jsonb_build_object(
      'action', 'link_live_session',
      'live_session_id', target_live_session_id
    )
  );

  return result_row;
end;
$$;

revoke all on function public.link_publisher_stream_live_session(uuid, uuid) from public, anon;
grant execute on function public.link_publisher_stream_live_session(uuid, uuid) to authenticated;

create or replace function public.root_terminate_publisher_stream(
  target_stream_id uuid,
  target_reason text default null
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
  next_status text;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not (
    public.is_root_owner()
    or public.has_platform_permission('publisher.review')
  ) then
    raise exception 'ROOT_OR_PUBLISHER_REVIEW_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if stream_row.status in ('ended', 'cancelled') then
    return stream_row;
  end if;

  -- Force terminal: ending -> ended; active broadcast paths -> ended; prep paths -> cancelled; else failed.
  next_status := case
    when stream_row.status in ('connecting', 'live', 'reconnecting', 'ending') then 'ended'
    when stream_row.status in ('draft', 'scheduled', 'ready') then 'cancelled'
    else 'failed'
  end;

  update public.publisher_streams
  set
    status = next_status,
    ended_at = coalesce(ended_at, now()),
    connection_state = 'DISCONNECTED',
    health_status = 'DISCONNECTED',
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    'STREAM_TERMINATED_BY_ROOT',
    stream_row.status,
    result_row.status,
    coalesce(nullif(btrim(target_reason), ''), 'Terminated by platform review'),
    null,
    jsonb_build_object('forced', true)
  );

  return result_row;
end;
$$;

revoke all on function public.root_terminate_publisher_stream(uuid, text) from public, anon;
grant execute on function public.root_terminate_publisher_stream(uuid, text) to authenticated;

create or replace function public.service_apply_publisher_stream_ingress_event(
  target_stream_id uuid,
  target_event_type text,
  target_connection_state text default null,
  target_health_status text default null,
  target_provider_ingress_id text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
  safe_metadata jsonb := coalesce(target_metadata, '{}'::jsonb);
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_metadata) is distinct from 'object' then
    raise exception 'STREAM_INGRESS_METADATA_INVALID' using errcode = '22023';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if target_connection_state is not null and target_connection_state not in (
    'NOT_CONNECTED', 'WAITING', 'CONNECTED', 'PUBLISHING',
    'UNHEALTHY', 'DISCONNECTED', 'REVOKED'
  ) then
    raise exception 'STREAM_CONNECTION_STATE_INVALID' using errcode = '22023';
  end if;
  if target_health_status is not null and target_health_status not in (
    'EXCELLENT', 'GOOD', 'DEGRADED', 'POOR', 'DISCONNECTED'
  ) then
    raise exception 'STREAM_HEALTH_STATUS_INVALID' using errcode = '22023';
  end if;

  update public.publisher_streams
  set
    connection_state = coalesce(target_connection_state, connection_state),
    health_status = coalesce(target_health_status, health_status),
    metadata = metadata || (safe_metadata - 'plaintext_secret' - 'secret' - 'stream_key'),
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  if target_provider_ingress_id is not null then
    update public.publisher_stream_credentials
    set provider_ingress_id = target_provider_ingress_id
    where stream_id = target_stream_id
      and status = 'active';
  end if;

  -- Optional lifecycle hints from webhook event names (still matrix-validated).
  if target_event_type in ('ingress_started', 'track_published')
     and public.publisher_stream_transition_allowed(result_row.status, 'live') then
    result_row := public.transition_publisher_stream(
      target_stream_id, 'live', target_event_type, null
    );
  elsif target_event_type in ('ingress_ended', 'ingress_finished')
     and public.publisher_stream_transition_allowed(result_row.status, 'ending') then
    result_row := public.transition_publisher_stream(
      target_stream_id, 'ending', target_event_type, null
    );
    if public.publisher_stream_transition_allowed(result_row.status, 'ended') then
      result_row := public.transition_publisher_stream(
        target_stream_id, 'ended', target_event_type, null
      );
    end if;
  elsif target_event_type in ('ingress_failed', 'ingress_error')
     and public.publisher_stream_transition_allowed(result_row.status, 'failed') then
    result_row := public.transition_publisher_stream(
      target_stream_id, 'failed', target_event_type, null
    );
  else
    perform public.publisher_stream_append_audit(
      target_stream_id,
      null,
      'STREAM_TRANSITION',
      stream_row.status,
      result_row.status,
      target_event_type,
      null,
      jsonb_build_object(
        'source', 'ingress_webhook',
        'event_type', target_event_type,
        'connection_state', result_row.connection_state,
        'health_status', result_row.health_status
      )
    );
  end if;

  return result_row;
end;
$$;

revoke all on function public.service_apply_publisher_stream_ingress_event(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.service_apply_publisher_stream_ingress_event(uuid, text, text, text, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 7) RLS policies
-- ---------------------------------------------------------------------------
-- Streams: owner select only (discovery stays on community_live_screen_sessions). No direct writes.
drop policy if exists publisher_streams_owner_select on public.publisher_streams;
create policy publisher_streams_owner_select
  on public.publisher_streams
  for select
  to authenticated
  using (owner_user_id = auth.uid());

grant select on table public.publisher_streams to authenticated;
revoke insert, update, delete on table public.publisher_streams from authenticated, anon, public;

-- Credentials: no authenticated table select (secret_hash must not be client-readable). RPC JSON only.
drop policy if exists publisher_stream_credentials_deny_authenticated on public.publisher_stream_credentials;
-- Explicit: no policies for authenticated => default deny under FORCE RLS.
revoke all on table public.publisher_stream_credentials from authenticated, anon, public;

-- Audit: owner, root, or publisher.review
drop policy if exists publisher_stream_audit_select on public.publisher_stream_audit_events;
create policy publisher_stream_audit_select
  on public.publisher_stream_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.publisher_streams s
      where s.id = publisher_stream_audit_events.stream_id
        and s.owner_user_id = auth.uid()
    )
    or public.is_root_owner()
    or public.has_platform_permission('publisher.review')
  );

grant select on table public.publisher_stream_audit_events to authenticated;
revoke insert, update, delete on table public.publisher_stream_audit_events
  from authenticated, anon, public;

-- Rate limits: no authenticated access
revoke all on table public.publisher_stream_rate_limits from authenticated, anon, public;

comment on function public.create_publisher_stream(text, text, text, text[], text, text, timestamptz, text, uuid) is
  'Create a publisher stream (draft or scheduled). Requires user_can_broadcast_on_picom_live. Rate limit 20/hour.';

comment on function public.create_publisher_stream_credential(uuid) is
  'Create OBS_EXTERNAL credential; returns plaintext once. Hashed with extensions.digest; never stored plaintext.';

comment on function public.service_apply_publisher_stream_ingress_event(uuid, text, text, text, text, jsonb) is
  'service_role webhook helper for LiveKit Ingress connection/health updates.';

commit;
