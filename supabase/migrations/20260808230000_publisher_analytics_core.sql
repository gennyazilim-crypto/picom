-- Publisher Analytics core: events, viewer sessions, ingest helpers (TASK29).
-- Keyed to publisher_streams.id. RPC-only mutations for clients.

begin;

create table if not exists public.publisher_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (char_length(event_type) between 3 and 64),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  publisher_user_id uuid not null references public.profiles(id) on delete cascade,
  viewer_user_id uuid null references public.profiles(id) on delete set null,
  viewer_session_id uuid null,
  event_at timestamptz not null,
  received_at timestamptz not null default now(),
  source text not null default 'server'
    check (source in ('server', 'client', 'livekit_webhook', 'worker', 'finalizer')),
  client_platform text null
    check (client_platform is null or client_platform in (
      'desktop_windows', 'desktop_linux', 'desktop_macos', 'web', 'mobile_future', 'unknown'
    )),
  app_version text null check (app_version is null or char_length(app_version) <= 40),
  locale text null check (locale is null or char_length(locale) <= 16),
  device_class text null check (device_class is null or device_class in ('desktop', 'web', 'unknown')),
  correlation_id text null check (correlation_id is null or char_length(correlation_id) <= 80),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 160),
  metadata jsonb not null default '{}'::jsonb,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  constraint publisher_analytics_events_idempotency_unique unique (idempotency_key),
  constraint publisher_analytics_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.publisher_analytics_events is
  'Append-oriented publisher live analytics events. No email/phone/tokens/stream keys. Idempotent by idempotency_key.';

create index if not exists publisher_analytics_events_stream_at_idx
  on public.publisher_analytics_events (stream_id, event_at desc);
create index if not exists publisher_analytics_events_publisher_at_idx
  on public.publisher_analytics_events (publisher_user_id, event_at desc);
create index if not exists publisher_analytics_events_session_at_idx
  on public.publisher_analytics_events (viewer_session_id, event_at desc)
  where viewer_session_id is not null;
create index if not exists publisher_analytics_events_type_stream_idx
  on public.publisher_analytics_events (event_type, stream_id, event_at desc);

create table if not exists public.publisher_viewer_sessions (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  publisher_user_id uuid not null references public.profiles(id) on delete cascade,
  viewer_user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  left_at timestamptz null,
  watch_seconds integer not null default 0 check (watch_seconds >= 0),
  termination_reason text null
    check (termination_reason is null or termination_reason in (
      'client_leave', 'stream_ended', 'stale', 'reconnect_superseded', 'banned', 'system'
    )),
  client_platform text null
    check (client_platform is null or client_platform in (
      'desktop_windows', 'desktop_linux', 'desktop_macos', 'web', 'mobile_future', 'unknown'
    )),
  locale text null check (locale is null or char_length(locale) <= 16),
  source_allowlist text null
    check (source_allowlist is null or source_allowlist in (
      'live_now', 'notification', 'profile', 'direct_link', 'community', 'search', 'featured', 'other'
    )),
  notification_delivery_id uuid null,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.publisher_viewer_sessions is
  'Canonical authenticated viewer sessions for publisher_streams. Watch time credited from bounded heartbeats.';

create index if not exists publisher_viewer_sessions_stream_joined_idx
  on public.publisher_viewer_sessions (stream_id, joined_at desc);
create index if not exists publisher_viewer_sessions_stream_heartbeat_idx
  on public.publisher_viewer_sessions (stream_id, last_heartbeat_at desc)
  where left_at is null;
create index if not exists publisher_viewer_sessions_viewer_stream_idx
  on public.publisher_viewer_sessions (viewer_user_id, stream_id, joined_at desc);
create unique index if not exists publisher_viewer_sessions_one_open_idx
  on public.publisher_viewer_sessions (stream_id, viewer_user_id)
  where left_at is null;

create table if not exists public.publisher_stream_health_samples (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  sample_at timestamptz not null default now(),
  source text not null default 'ingress'
    check (source in ('ingress', 'livekit', 'client', 'system')),
  health_status text null,
  connection_state text null,
  bitrate_kbps integer null check (bitrate_kbps is null or bitrate_kbps >= 0),
  rtt_ms integer null check (rtt_ms is null or rtt_ms >= 0),
  packet_loss_pct numeric(6,3) null check (packet_loss_pct is null or (packet_loss_pct >= 0 and packet_loss_pct <= 100)),
  jitter_ms integer null check (jitter_ms is null or jitter_ms >= 0),
  fps integer null check (fps is null or fps >= 0),
  resolution text null check (resolution is null or char_length(resolution) <= 32),
  reconnect_state text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists publisher_stream_health_samples_stream_at_idx
  on public.publisher_stream_health_samples (stream_id, sample_at desc);

create table if not exists public.publisher_analytics_rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 40),
  window_started_at timestamptz not null,
  attempts integer not null default 1 check (attempts >= 0),
  primary key (user_id, stream_id, action, window_started_at)
);

alter table public.publisher_analytics_events enable row level security;
alter table public.publisher_viewer_sessions enable row level security;
alter table public.publisher_stream_health_samples enable row level security;
alter table public.publisher_analytics_rate_limits enable row level security;

revoke all on table public.publisher_analytics_events from public, anon, authenticated;
revoke all on table public.publisher_viewer_sessions from public, anon, authenticated;
revoke all on table public.publisher_stream_health_samples from public, anon, authenticated;
revoke all on table public.publisher_analytics_rate_limits from public, anon, authenticated;
grant all on table public.publisher_analytics_events to service_role;
grant all on table public.publisher_viewer_sessions to service_role;
grant all on table public.publisher_stream_health_samples to service_role;
grant all on table public.publisher_analytics_rate_limits to service_role;

-- No authenticated SELECT on raw events/sessions (aggregates via RPC only).
-- Owner may see own open session row for heartbeat continuity via RPC, not table grants.

create or replace function public.publisher_analytics_sanitize_metadata(raw jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_object_agg(k, v)
      from jsonb_each(coalesce(raw, '{}'::jsonb)) as t(k, v)
      where k !~* '(email|phone|token|secret|password|stream_key|authorization|body|message|ip)'
        and char_length(k) <= 40
    ),
    '{}'::jsonb
  );
$$;

create or replace function public.publisher_analytics_is_excluded_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_stats_exclusions e
    where e.entity_type = 'profile'
      and e.entity_id = target_user_id
      and e.reason in ('test', 'seed', 'system', 'bot')
  );
$$;

create or replace function public.publisher_analytics_consume_rate_limit(
  target_stream_id uuid,
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
  actor uuid := auth.uid();
  window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  current_attempts integer;
begin
  if actor is null then
    return false;
  end if;
  insert into public.publisher_analytics_rate_limits (user_id, stream_id, action, window_started_at, attempts)
  values (actor, target_stream_id, target_action, window_start, 1)
  on conflict (user_id, stream_id, action, window_started_at)
  do update set attempts = public.publisher_analytics_rate_limits.attempts + 1
  returning attempts into current_attempts;
  delete from public.publisher_analytics_rate_limits
  where window_started_at < now() - make_interval(secs => greatest(window_seconds * 4, 3600));
  return current_attempts <= max_attempts;
end;
$$;

revoke all on function public.publisher_analytics_consume_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.publisher_analytics_consume_rate_limit(uuid, text, integer, integer)
  to service_role;

create or replace function public.publisher_analytics_append_event(
  target_event_type text,
  target_stream_id uuid,
  target_publisher_user_id uuid,
  target_viewer_user_id uuid,
  target_viewer_session_id uuid,
  target_event_at timestamptz,
  target_source text,
  target_client_platform text,
  target_locale text,
  target_device_class text,
  target_correlation_id text,
  target_idempotency_key text,
  target_metadata jsonb,
  target_internal_test boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_id uuid;
  safe_meta jsonb := public.publisher_analytics_sanitize_metadata(target_metadata);
  safe_at timestamptz := coalesce(target_event_at, now());
begin
  if target_idempotency_key is null or char_length(btrim(target_idempotency_key)) < 8 then
    raise exception 'IDEMPOTENCY_REQUIRED';
  end if;
  -- Bound client-provided event_at skew (±10 minutes).
  if safe_at < now() - interval '10 minutes' then
    safe_at := now() - interval '10 minutes';
  elsif safe_at > now() + interval '2 minutes' then
    safe_at := now();
  end if;

  insert into public.publisher_analytics_events (
    event_type, stream_id, publisher_user_id, viewer_user_id, viewer_session_id,
    event_at, source, client_platform, locale, device_class, correlation_id,
    idempotency_key, metadata, internal_test
  ) values (
    target_event_type, target_stream_id, target_publisher_user_id, target_viewer_user_id, target_viewer_session_id,
    safe_at, coalesce(nullif(target_source, ''), 'server'), target_client_platform, target_locale, target_device_class,
    target_correlation_id, btrim(target_idempotency_key), safe_meta, coalesce(target_internal_test, false)
  )
  on conflict (idempotency_key) do nothing
  returning id into event_id;

  if event_id is null then
    select id into event_id
    from public.publisher_analytics_events
    where idempotency_key = btrim(target_idempotency_key);
  end if;
  return event_id;
end;
$$;

revoke all on function public.publisher_analytics_append_event(text, uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.publisher_analytics_append_event(text, uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, jsonb, boolean)
  to service_role;

-- Watch-time credit: add min(elapsed_since_last_heartbeat, 45s) on each heartbeat; stale close after 90s.
create or replace function public.publisher_analytics_credit_watch_seconds(
  previous_heartbeat timestamptz,
  current_heartbeat timestamptz
)
returns integer
language sql
immutable
as $$
  select greatest(
    0,
    least(
      45,
      floor(extract(epoch from (current_heartbeat - previous_heartbeat)))::integer
    )
  );
$$;

create or replace function public.join_publisher_stream_viewer_session(
  target_stream_id uuid,
  client_platform text default 'unknown',
  locale text default null,
  source_allowlist text default 'other',
  notification_delivery_id uuid default null,
  idempotency_key text default null
)
returns public.publisher_viewer_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  existing public.publisher_viewer_sessions%rowtype;
  result_row public.publisher_viewer_sessions%rowtype;
  safe_platform text := coalesce(nullif(client_platform, ''), 'unknown');
  safe_source text := coalesce(nullif(source_allowlist, ''), 'other');
  is_test boolean;
  key text;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if safe_platform not in ('desktop_windows', 'desktop_linux', 'desktop_macos', 'web', 'mobile_future', 'unknown') then
    safe_platform := 'unknown';
  end if;
  if safe_source not in ('live_now', 'notification', 'profile', 'direct_link', 'community', 'search', 'featured', 'other') then
    safe_source := 'other';
  end if;

  select * into stream_row from public.publisher_streams s where s.id = target_stream_id for share;
  if not found then
    raise exception 'STREAM_NOT_FOUND';
  end if;
  if stream_row.status not in ('live', 'reconnecting', 'ready', 'connecting') then
    raise exception 'STREAM_NOT_VIEWABLE';
  end if;
  if stream_row.owner_user_id = actor then
    raise exception 'PUBLISHER_NOT_VIEWER';
  end if;
  if not public.publisher_analytics_consume_rate_limit(target_stream_id, 'viewer_join', 20, 60) then
    raise exception 'RATE_LIMITED';
  end if;

  is_test := public.publisher_analytics_is_excluded_user(actor);

  select * into existing
  from public.publisher_viewer_sessions v
  where v.stream_id = target_stream_id
    and v.viewer_user_id = actor
    and v.left_at is null
  for update;

  if found then
    -- Reconnect continuity within grace: refresh heartbeat, keep session.
    update public.publisher_viewer_sessions
    set last_heartbeat_at = now(),
        updated_at = now(),
        client_platform = coalesce(safe_platform, client_platform),
        locale = coalesce(left(nullif(locale, ''), 16), locale)
    where id = existing.id
    returning * into result_row;
  else
    insert into public.publisher_viewer_sessions (
      stream_id, publisher_user_id, viewer_user_id, client_platform, locale,
      source_allowlist, notification_delivery_id, internal_test
    ) values (
      target_stream_id, stream_row.owner_user_id, actor, safe_platform, left(nullif(locale, ''), 16),
      safe_source, notification_delivery_id, is_test
    )
    returning * into result_row;
  end if;

  key := coalesce(nullif(btrim(idempotency_key), ''), 'viewer_join:' || result_row.id::text || ':' || floor(extract(epoch from now()))::text);
  perform public.publisher_analytics_append_event(
    'VIEWER_JOINED', target_stream_id, stream_row.owner_user_id, actor, result_row.id,
    now(), 'client', safe_platform, left(nullif(locale, ''), 16), 'desktop',
    null, key, jsonb_build_object('source', safe_source), is_test
  );

  return result_row;
end;
$$;

create or replace function public.record_publisher_viewer_heartbeat(
  target_session_id uuid,
  idempotency_key text default null
)
returns public.publisher_viewer_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  session_row public.publisher_viewer_sessions%rowtype;
  credit integer;
  key text;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into session_row
  from public.publisher_viewer_sessions v
  where v.id = target_session_id
  for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;
  if session_row.viewer_user_id is distinct from actor then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if session_row.left_at is not null then
    raise exception 'SESSION_CLOSED';
  end if;
  if not public.publisher_analytics_consume_rate_limit(session_row.stream_id, 'viewer_heartbeat', 6, 10) then
    raise exception 'RATE_LIMITED';
  end if;

  credit := public.publisher_analytics_credit_watch_seconds(session_row.last_heartbeat_at, now());
  update public.publisher_viewer_sessions
  set watch_seconds = watch_seconds + credit,
      last_heartbeat_at = now(),
      updated_at = now()
  where id = session_row.id
  returning * into session_row;

  key := coalesce(nullif(btrim(idempotency_key), ''), 'viewer_hb:' || session_row.id::text || ':' || floor(extract(epoch from now()) / 20)::text);
  perform public.publisher_analytics_append_event(
    'VIEWER_HEARTBEAT', session_row.stream_id, session_row.publisher_user_id, actor, session_row.id,
    now(), 'client', session_row.client_platform, session_row.locale, 'desktop',
    null, key, jsonb_build_object('credit_seconds', credit), session_row.internal_test
  );

  return session_row;
end;
$$;

create or replace function public.leave_publisher_stream_viewer_session(
  target_session_id uuid,
  idempotency_key text default null
)
returns public.publisher_viewer_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  session_row public.publisher_viewer_sessions%rowtype;
  credit integer;
  key text;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into session_row from public.publisher_viewer_sessions v where v.id = target_session_id for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;
  if session_row.viewer_user_id is distinct from actor then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if session_row.left_at is not null then
    return session_row;
  end if;

  credit := public.publisher_analytics_credit_watch_seconds(session_row.last_heartbeat_at, now());
  update public.publisher_viewer_sessions
  set watch_seconds = watch_seconds + credit,
      last_heartbeat_at = now(),
      left_at = now(),
      termination_reason = 'client_leave',
      updated_at = now()
  where id = session_row.id
  returning * into session_row;

  key := coalesce(nullif(btrim(idempotency_key), ''), 'viewer_leave:' || session_row.id::text);
  perform public.publisher_analytics_append_event(
    'VIEWER_LEFT', session_row.stream_id, session_row.publisher_user_id, actor, session_row.id,
    now(), 'client', session_row.client_platform, session_row.locale, 'desktop',
    null, key, jsonb_build_object('watch_seconds', session_row.watch_seconds), session_row.internal_test
  );
  return session_row;
end;
$$;

revoke all on function public.join_publisher_stream_viewer_session(uuid, text, text, text, uuid, text) from public, anon;
revoke all on function public.record_publisher_viewer_heartbeat(uuid, text) from public, anon;
revoke all on function public.leave_publisher_stream_viewer_session(uuid, text) from public, anon;
grant execute on function public.join_publisher_stream_viewer_session(uuid, text, text, text, uuid, text) to authenticated;
grant execute on function public.record_publisher_viewer_heartbeat(uuid, text) to authenticated;
grant execute on function public.leave_publisher_stream_viewer_session(uuid, text) to authenticated;
grant execute on function public.publisher_analytics_is_excluded_user(uuid) to authenticated, service_role;

commit;
