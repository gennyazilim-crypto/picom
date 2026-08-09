-- Publisher Analytics rollups, finalizer, live summary, read RPCs (TASK29).

begin;

create table if not exists public.publisher_stream_analytics_summaries (
  stream_id uuid primary key references public.publisher_streams(id) on delete cascade,
  publisher_user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz null,
  ended_at timestamptz null,
  unique_viewers integer not null default 0 check (unique_viewers >= 0),
  viewer_sessions integer not null default 0 check (viewer_sessions >= 0),
  peak_concurrent integer not null default 0 check (peak_concurrent >= 0),
  current_concurrent integer not null default 0 check (current_concurrent >= 0),
  total_watch_seconds bigint not null default 0 check (total_watch_seconds >= 0),
  avg_watch_seconds numeric(12,2) null,
  chat_messages integer not null default 0 check (chat_messages >= 0),
  reactions integer not null default 0 check (reactions >= 0),
  moderation_actions integer not null default 0 check (moderation_actions >= 0),
  followers_gained integer not null default 0 check (followers_gained >= 0),
  notification_joins integer not null default 0 check (notification_joins >= 0),
  reconnect_count integer not null default 0 check (reconnect_count >= 0),
  health_sample_count integer not null default 0 check (health_sample_count >= 0),
  finalized boolean not null default false,
  finalized_at timestamptz null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.publisher_stream_analytics_summaries is
  'Per-stream analytics summary. Live metrics update while stream active; finalized metrics set by finalizer.';

create index if not exists publisher_stream_analytics_summaries_publisher_started_idx
  on public.publisher_stream_analytics_summaries (publisher_user_id, started_at desc nulls last);

create table if not exists public.publisher_analytics_minute_buckets (
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  bucket_at timestamptz not null,
  concurrent_viewers integer not null default 0 check (concurrent_viewers >= 0),
  joins integer not null default 0 check (joins >= 0),
  leaves integer not null default 0 check (leaves >= 0),
  watch_seconds_added integer not null default 0 check (watch_seconds_added >= 0),
  primary key (stream_id, bucket_at)
);

create index if not exists publisher_analytics_minute_buckets_stream_idx
  on public.publisher_analytics_minute_buckets (stream_id, bucket_at desc);

alter table public.publisher_stream_analytics_summaries enable row level security;
alter table public.publisher_analytics_minute_buckets enable row level security;
revoke all on table public.publisher_stream_analytics_summaries from public, anon, authenticated;
revoke all on table public.publisher_analytics_minute_buckets from public, anon, authenticated;
grant all on table public.publisher_stream_analytics_summaries to service_role;
grant all on table public.publisher_analytics_minute_buckets to service_role;

create or replace function public.publisher_analytics_ensure_summary(target_stream_id uuid)
returns public.publisher_stream_analytics_summaries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stream_row public.publisher_streams%rowtype;
  summary public.publisher_stream_analytics_summaries%rowtype;
begin
  select * into stream_row from public.publisher_streams where id = target_stream_id;
  if not found then
    raise exception 'STREAM_NOT_FOUND';
  end if;
  insert into public.publisher_stream_analytics_summaries (
    stream_id, publisher_user_id, started_at, ended_at
  ) values (
    stream_row.id, stream_row.owner_user_id, stream_row.started_at, stream_row.ended_at
  )
  on conflict (stream_id) do update
    set publisher_user_id = excluded.publisher_user_id,
        started_at = coalesce(public.publisher_stream_analytics_summaries.started_at, excluded.started_at),
        ended_at = coalesce(excluded.ended_at, public.publisher_stream_analytics_summaries.ended_at),
        updated_at = now()
  returning * into summary;
  return summary;
end;
$$;

create or replace function public.publisher_analytics_count_concurrent(target_stream_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.publisher_viewer_sessions v
  where v.stream_id = target_stream_id
    and v.left_at is null
    and v.internal_test = false
    and v.last_heartbeat_at >= now() - interval '90 seconds';
$$;

create or replace function public.publisher_analytics_close_stale_sessions(
  target_stream_id uuid default null,
  stale_after_seconds integer default 90
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  closed integer := 0;
  rec public.publisher_viewer_sessions%rowtype;
  credit integer;
begin
  for rec in
    select *
    from public.publisher_viewer_sessions v
    where v.left_at is null
      and v.last_heartbeat_at < now() - make_interval(secs => greatest(stale_after_seconds, 30))
      and (target_stream_id is null or v.stream_id = target_stream_id)
    for update skip locked
  loop
    credit := public.publisher_analytics_credit_watch_seconds(rec.last_heartbeat_at, rec.last_heartbeat_at + interval '45 seconds');
    update public.publisher_viewer_sessions
    set watch_seconds = watch_seconds + credit,
        left_at = last_heartbeat_at + interval '45 seconds',
        termination_reason = 'stale',
        updated_at = now()
    where id = rec.id;
    closed := closed + 1;
  end loop;
  return closed;
end;
$$;

create or replace function public.refresh_publisher_stream_live_analytics(target_stream_id uuid)
returns public.publisher_stream_analytics_summaries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  summary public.publisher_stream_analytics_summaries%rowtype;
  concurrent integer;
  bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / 60) * 60);
begin
  perform public.publisher_analytics_close_stale_sessions(target_stream_id, 90);
  summary := public.publisher_analytics_ensure_summary(target_stream_id);
  if summary.finalized then
    return summary;
  end if;

  concurrent := public.publisher_analytics_count_concurrent(target_stream_id);

  update public.publisher_stream_analytics_summaries s
  set current_concurrent = concurrent,
      peak_concurrent = greatest(s.peak_concurrent, concurrent),
      viewer_sessions = (
        select count(*)::integer from public.publisher_viewer_sessions v
        where v.stream_id = target_stream_id and v.internal_test = false
      ),
      unique_viewers = (
        select count(distinct v.viewer_user_id)::integer from public.publisher_viewer_sessions v
        where v.stream_id = target_stream_id and v.internal_test = false
      ),
      total_watch_seconds = (
        select coalesce(sum(v.watch_seconds), 0)::bigint from public.publisher_viewer_sessions v
        where v.stream_id = target_stream_id and v.internal_test = false
      ),
      updated_at = now()
  where s.stream_id = target_stream_id
  returning * into summary;

  insert into public.publisher_analytics_minute_buckets (stream_id, bucket_at, concurrent_viewers)
  values (target_stream_id, bucket, concurrent)
  on conflict (stream_id, bucket_at) do update
    set concurrent_viewers = greatest(public.publisher_analytics_minute_buckets.concurrent_viewers, excluded.concurrent_viewers);

  return summary;
end;
$$;

create or replace function public.finalize_publisher_stream_analytics(target_stream_id uuid)
returns public.publisher_stream_analytics_summaries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stream_row public.publisher_streams%rowtype;
  summary public.publisher_stream_analytics_summaries%rowtype;
  window_start timestamptz;
  window_end timestamptz;
  chat_count integer := 0;
  reaction_count integer := 0;
  mod_count integer := 0;
  follow_count integer := 0;
  notif_joins integer := 0;
  reconnects integer := 0;
  health_count integer := 0;
  avg_watch numeric(12,2);
begin
  select * into stream_row from public.publisher_streams where id = target_stream_id for update;
  if not found then
    raise exception 'STREAM_NOT_FOUND';
  end if;

  perform public.publisher_analytics_close_stale_sessions(target_stream_id, 90);
  -- Close remaining open sessions at stream end.
  update public.publisher_viewer_sessions
  set left_at = coalesce(left_at, now()),
      termination_reason = coalesce(termination_reason, 'stream_ended'),
      watch_seconds = watch_seconds + public.publisher_analytics_credit_watch_seconds(last_heartbeat_at, now()),
      last_heartbeat_at = now(),
      updated_at = now()
  where stream_id = target_stream_id
    and left_at is null;

  summary := public.publisher_analytics_ensure_summary(target_stream_id);
  -- Idempotent: re-running refreshes metrics but does not double-credit sessions.
  window_start := coalesce(stream_row.started_at, summary.started_at, stream_row.created_at);
  window_end := coalesce(stream_row.ended_at, now());

  if to_regclass('public.live_chat_messages') is not null then
    execute $q$
      select count(*)::integer from public.live_chat_messages m
      where m.stream_id = $1
        and m.message_type = 'text'
        and m.created_at between $2 and $3
    $q$ into chat_count using target_stream_id, window_start, window_end;
  end if;

  if to_regclass('public.live_chat_reactions') is not null then
    execute $q$
      select count(*)::integer from public.live_chat_reactions r
      join public.live_chat_messages m on m.id = r.message_id
      where m.stream_id = $1
        and r.created_at between $2 and $3
    $q$ into reaction_count using target_stream_id, window_start, window_end;
  end if;

  if to_regclass('public.live_chat_audit_events') is not null then
    execute $q$
      select count(*)::integer from public.live_chat_audit_events a
      where a.stream_id = $1
        and a.created_at between $2 and $3
        and a.event_type in ('MESSAGE_REMOVED','USER_TIMED_OUT','USER_BANNED','USER_UNBANNED')
    $q$ into mod_count using target_stream_id, window_start, window_end;
  end if;

  select count(*)::integer into follow_count
  from public.user_follows f
  where f.followed_id = stream_row.owner_user_id
    and f.created_at between window_start and window_end
    and not public.publisher_analytics_is_excluded_user(f.follower_id);

  select count(*)::integer into notif_joins
  from public.publisher_viewer_sessions v
  where v.stream_id = target_stream_id
    and v.internal_test = false
    and v.source_allowlist = 'notification';

  select count(*)::integer into reconnects
  from public.publisher_analytics_events e
  where e.stream_id = target_stream_id
    and e.event_type in ('STREAM_RECONNECTING', 'STREAM_RECONNECTED')
    and e.internal_test = false;

  select count(*)::integer into health_count
  from public.publisher_stream_health_samples h
  where h.stream_id = target_stream_id;

  select
    count(distinct v.viewer_user_id)::integer,
    count(*)::integer,
    coalesce(sum(v.watch_seconds), 0)::bigint,
    case when count(*) = 0 then null else round((sum(v.watch_seconds)::numeric / count(*)), 2) end
  into summary.unique_viewers, summary.viewer_sessions, summary.total_watch_seconds, avg_watch
  from public.publisher_viewer_sessions v
  where v.stream_id = target_stream_id
    and v.internal_test = false;

  update public.publisher_stream_analytics_summaries s
  set started_at = window_start,
      ended_at = window_end,
      unique_viewers = coalesce(summary.unique_viewers, 0),
      viewer_sessions = coalesce(summary.viewer_sessions, 0),
      peak_concurrent = greatest(s.peak_concurrent, public.publisher_analytics_count_concurrent(target_stream_id), 0),
      current_concurrent = 0,
      total_watch_seconds = coalesce(summary.total_watch_seconds, 0),
      avg_watch_seconds = avg_watch,
      chat_messages = chat_count,
      reactions = reaction_count,
      moderation_actions = mod_count,
      followers_gained = follow_count,
      notification_joins = notif_joins,
      reconnect_count = reconnects,
      health_sample_count = health_count,
      finalized = true,
      finalized_at = now(),
      updated_at = now()
  where s.stream_id = target_stream_id
  returning * into summary;

  perform public.publisher_analytics_append_event(
    'STREAM_ENDED', target_stream_id, stream_row.owner_user_id, null, null,
    now(), 'finalizer', null, null, null, null,
    'finalize:' || target_stream_id::text,
    jsonb_build_object('finalized', true),
    false
  );

  return summary;
end;
$$;

create or replace function public.service_record_publisher_analytics_livekit_event(
  target_stream_id uuid,
  target_event_type text,
  target_event_id text,
  target_participant_identity text,
  target_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stream_row public.publisher_streams%rowtype;
  viewer_uuid uuid;
  mapped_type text;
  key text := 'livekit:' || lower(btrim(target_event_id));
begin
  select * into stream_row from public.publisher_streams where id = target_stream_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'STREAM_NOT_FOUND');
  end if;

  mapped_type := case target_event_type
    when 'participant_joined' then 'VIEWER_JOINED'
    when 'participant_left' then 'VIEWER_LEFT'
    when 'participant_connection_aborted' then 'VIEWER_LEFT'
    when 'room_started' then 'STREAM_LIVE_CONFIRMED'
    when 'room_finished' then 'STREAM_ENDED'
    else null
  end;
  if mapped_type is null then
    return jsonb_build_object('ok', true, 'ignored', true);
  end if;

  begin
    viewer_uuid := nullif(target_participant_identity, '')::uuid;
  exception when others then
    viewer_uuid := null;
  end;

  -- Do not count publisher identity as a viewer.
  if viewer_uuid is not null and viewer_uuid = stream_row.owner_user_id then
    return jsonb_build_object('ok', true, 'ignored', true, 'reason', 'publisher_identity');
  end if;

  perform public.publisher_analytics_append_event(
    mapped_type, target_stream_id, stream_row.owner_user_id, viewer_uuid, null,
    coalesce(target_occurred_at, now()), 'livekit_webhook', null, null, null, null,
    key, jsonb_build_object('livekit_event', target_event_type), false
  );

  if mapped_type in ('VIEWER_JOINED', 'VIEWER_LEFT') then
    perform public.refresh_publisher_stream_live_analytics(target_stream_id);
  end if;
  if mapped_type = 'STREAM_ENDED' or target_event_type = 'room_finished' then
    perform public.finalize_publisher_stream_analytics(target_stream_id);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_publisher_stream_analytics(
  target_stream_id uuid,
  include_internal boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  summary public.publisher_stream_analytics_summaries%rowtype;
  can_root boolean := false;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into stream_row from public.publisher_streams where id = target_stream_id;
  if not found then
    raise exception 'STREAM_NOT_FOUND';
  end if;

  can_root := coalesce(public.is_root_owner() or public.has_platform_role('root_owner') or public.has_platform_role('platform_admin'), false);
  if stream_row.owner_user_id is distinct from actor and not can_root then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  -- dashboard.read does NOT grant publisher analytics.
  if include_internal and not can_root then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  summary := public.publisher_analytics_ensure_summary(target_stream_id);
  if not summary.finalized then
    summary := public.refresh_publisher_stream_live_analytics(target_stream_id);
  end if;

  return jsonb_build_object(
    'stream_id', summary.stream_id,
    'publisher_user_id', summary.publisher_user_id,
    'started_at', summary.started_at,
    'ended_at', summary.ended_at,
    'unique_viewers', summary.unique_viewers,
    'viewer_sessions', summary.viewer_sessions,
    'peak_concurrent', summary.peak_concurrent,
    'current_concurrent', summary.current_concurrent,
    'total_watch_seconds', summary.total_watch_seconds,
    'avg_watch_seconds', summary.avg_watch_seconds,
    'chat_messages', summary.chat_messages,
    'reactions', summary.reactions,
    'moderation_actions', summary.moderation_actions,
    'followers_gained', summary.followers_gained,
    'notification_joins', summary.notification_joins,
    'reconnect_count', summary.reconnect_count,
    'health_sample_count', case when summary.health_sample_count = 0 then null else summary.health_sample_count end,
    'finalized', summary.finalized,
    'finalized_at', summary.finalized_at,
    'updated_at', summary.updated_at
  );
end;
$$;

create or replace function public.get_publisher_analytics_overview(
  range_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  days integer := greatest(1, least(coalesce(range_days, 30), 90));
  since timestamptz := now() - make_interval(days => days);
  result jsonb;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'range_days', days,
    'stream_count', count(*)::integer,
    'unique_viewers', coalesce(sum(s.unique_viewers), 0)::integer,
    'viewer_sessions', coalesce(sum(s.viewer_sessions), 0)::integer,
    'peak_concurrent', coalesce(max(s.peak_concurrent), 0)::integer,
    'total_watch_seconds', coalesce(sum(s.total_watch_seconds), 0)::bigint,
    'avg_watch_seconds', case when sum(s.viewer_sessions) = 0 then null
      else round((sum(s.total_watch_seconds)::numeric / nullif(sum(s.viewer_sessions), 0)), 2) end,
    'followers_gained', coalesce(sum(s.followers_gained), 0)::integer,
    'chat_messages', coalesce(sum(s.chat_messages), 0)::integer,
    'reactions', coalesce(sum(s.reactions), 0)::integer,
    'notification_joins', coalesce(sum(s.notification_joins), 0)::integer,
    'streams', coalesce(jsonb_agg(
      jsonb_build_object(
        'stream_id', s.stream_id,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'unique_viewers', s.unique_viewers,
        'peak_concurrent', s.peak_concurrent,
        'total_watch_seconds', s.total_watch_seconds,
        'chat_messages', s.chat_messages,
        'followers_gained', s.followers_gained,
        'finalized', s.finalized
      ) order by s.started_at desc nulls last
    ), '[]'::jsonb)
  )
  into result
  from public.publisher_stream_analytics_summaries s
  where s.publisher_user_id = actor
    and (s.started_at is null or s.started_at >= since);

  return coalesce(result, jsonb_build_object(
    'range_days', days,
    'stream_count', 0,
    'unique_viewers', 0,
    'viewer_sessions', 0,
    'peak_concurrent', 0,
    'total_watch_seconds', 0,
    'avg_watch_seconds', null,
    'followers_gained', 0,
    'chat_messages', 0,
    'reactions', 0,
    'notification_joins', 0,
    'streams', '[]'::jsonb
  ));
end;
$$;

create or replace function public.get_publisher_analytics_timeseries(
  target_stream_id uuid,
  granularity text default 'minute'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  buckets jsonb;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into stream_row from public.publisher_streams where id = target_stream_id;
  if not found then
    raise exception 'STREAM_NOT_FOUND';
  end if;
  if stream_row.owner_user_id is distinct from actor
     and not coalesce(public.is_root_owner() or public.has_platform_role('root_owner'), false) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'bucket_at', b.bucket_at,
      'concurrent_viewers', b.concurrent_viewers,
      'joins', b.joins,
      'leaves', b.leaves,
      'watch_seconds_added', b.watch_seconds_added
    ) order by b.bucket_at asc
  ), '[]'::jsonb)
  into buckets
  from (
    select * from public.publisher_analytics_minute_buckets m
    where m.stream_id = target_stream_id
    order by m.bucket_at asc
    limit 1440
  ) b;

  return jsonb_build_object(
    'stream_id', target_stream_id,
    'granularity', 'minute',
    'buckets', buckets
  );
end;
$$;

revoke all on function public.publisher_analytics_ensure_summary(uuid) from public, anon, authenticated;
revoke all on function public.publisher_analytics_count_concurrent(uuid) from public, anon, authenticated;
revoke all on function public.publisher_analytics_close_stale_sessions(uuid, integer) from public, anon, authenticated;
revoke all on function public.refresh_publisher_stream_live_analytics(uuid) from public, anon;
revoke all on function public.finalize_publisher_stream_analytics(uuid) from public, anon;
revoke all on function public.service_record_publisher_analytics_livekit_event(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_publisher_stream_analytics(uuid, boolean) from public, anon;
revoke all on function public.get_publisher_analytics_overview(integer) from public, anon;
revoke all on function public.get_publisher_analytics_timeseries(uuid, text) from public, anon;

grant execute on function public.publisher_analytics_ensure_summary(uuid) to service_role;
grant execute on function public.publisher_analytics_count_concurrent(uuid) to service_role;
grant execute on function public.publisher_analytics_close_stale_sessions(uuid, integer) to service_role, authenticated;
grant execute on function public.refresh_publisher_stream_live_analytics(uuid) to service_role, authenticated;
grant execute on function public.finalize_publisher_stream_analytics(uuid) to service_role, authenticated;
grant execute on function public.service_record_publisher_analytics_livekit_event(uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.get_publisher_stream_analytics(uuid, boolean) to authenticated;
grant execute on function public.get_publisher_analytics_overview(integer) to authenticated;
grant execute on function public.get_publisher_analytics_timeseries(uuid, text) to authenticated;

commit;
