-- TASK34: Live Now / Publisher production observability contracts.
-- Bounded metric buckets, alert state, health snapshots, Root-safe status aggregation.
-- Fail-closed: no public access. Observability write paths fail soft for callers.

begin;

create table if not exists public.live_now_ops_metric_buckets (
  id uuid primary key default gen_random_uuid(),
  service_key text not null,
  metric_name text not null,
  bucket_start timestamptz not null,
  sample_count bigint not null default 0 check (sample_count >= 0),
  success_count bigint not null default 0 check (success_count >= 0),
  error_count bigint not null default 0 check (error_count >= 0),
  latency_sum_ms bigint not null default 0 check (latency_sum_ms >= 0),
  latency_max_ms integer not null default 0 check (latency_max_ms >= 0),
  dimensions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint live_now_ops_metric_buckets_key_chk check (
    char_length(service_key) between 1 and 64
    and char_length(metric_name) between 1 and 64
    and service_key ~ '^[a-z0-9_.:-]+$'
    and metric_name ~ '^[a-z0-9_.:-]+$'
  )
);

create unique index if not exists live_now_ops_metric_buckets_uniq
  on public.live_now_ops_metric_buckets (service_key, metric_name, bucket_start);

create index if not exists live_now_ops_metric_buckets_updated_idx
  on public.live_now_ops_metric_buckets (updated_at desc);

create table if not exists public.live_now_ops_alert_states (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  severity text not null check (severity in ('SEV1', 'SEV2', 'SEV3', 'SEV4')),
  status text not null check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  service_key text not null,
  event_code text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  occurrence_count bigint not null default 1 check (occurrence_count >= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  correlation_id text,
  constraint live_now_ops_alert_states_key_chk check (
    char_length(dedupe_key) between 1 and 160
    and char_length(service_key) between 1 and 64
    and char_length(event_code) between 1 and 80
    and char_length(title) between 1 and 200
  )
);

create index if not exists live_now_ops_alert_states_open_idx
  on public.live_now_ops_alert_states (status, severity, last_seen_at desc)
  where status <> 'RESOLVED';

create table if not exists public.live_now_ops_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  service_key text not null,
  health_status text not null check (
    health_status in ('HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'DISABLED', 'NOT_CONFIGURED', 'UNKNOWN', 'BLOCKED', 'NOT_READY')
  ),
  check_kind text not null check (check_kind in ('LIVENESS', 'READINESS', 'DEPENDENCY', 'AGGREGATE')),
  details jsonb not null default '{}'::jsonb,
  correlation_id text,
  checked_at timestamptz not null default now(),
  constraint live_now_ops_health_snapshots_key_chk check (
    char_length(service_key) between 1 and 64
    and service_key ~ '^[a-z0-9_.:-]+$'
  )
);

create index if not exists live_now_ops_health_snapshots_svc_idx
  on public.live_now_ops_health_snapshots (service_key, checked_at desc);

create table if not exists public.live_now_ops_security_counters (
  id uuid primary key default gen_random_uuid(),
  counter_key text not null,
  window_start timestamptz not null,
  count_value bigint not null default 0 check (count_value >= 0),
  dimensions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint live_now_ops_security_counters_key_chk check (
    char_length(counter_key) between 1 and 80
    and counter_key ~ '^[a-z0-9_.:-]+$'
  )
);

create unique index if not exists live_now_ops_security_counters_uniq
  on public.live_now_ops_security_counters (counter_key, window_start);

alter table public.live_now_ops_metric_buckets enable row level security;
alter table public.live_now_ops_alert_states enable row level security;
alter table public.live_now_ops_health_snapshots enable row level security;
alter table public.live_now_ops_security_counters enable row level security;

revoke all on table public.live_now_ops_metric_buckets from public, anon, authenticated;
revoke all on table public.live_now_ops_alert_states from public, anon, authenticated;
revoke all on table public.live_now_ops_health_snapshots from public, anon, authenticated;
revoke all on table public.live_now_ops_security_counters from public, anon, authenticated;

create or replace function public.live_now_ops_require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not coalesce(public.is_app_admin(), false)
     and not coalesce(public.is_root_owner(), false)
     and not coalesce(public.has_platform_role('root_owner'), false)
     and not coalesce(public.has_platform_role('platform_admin'), false) then
    raise exception 'OPS_ADMIN_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.live_now_ops_require_admin() from public, anon;
grant execute on function public.live_now_ops_require_admin() to authenticated, service_role;

create or replace function public.record_live_now_ops_metric(
  p_service_key text,
  p_metric_name text,
  p_success boolean default true,
  p_latency_ms integer default null,
  p_dimensions jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket timestamptz := date_trunc('minute', now());
  v_latency integer := greatest(coalesce(p_latency_ms, 0), 0);
begin
  -- Soft-fail contract: invalid input is ignored (never break Go Live / chat).
  if p_service_key is null or p_metric_name is null then
    return;
  end if;
  if char_length(p_service_key) > 64 or char_length(p_metric_name) > 64 then
    return;
  end if;

  insert into public.live_now_ops_metric_buckets as b (
    service_key, metric_name, bucket_start, sample_count, success_count, error_count,
    latency_sum_ms, latency_max_ms, dimensions, updated_at
  ) values (
    lower(p_service_key), lower(p_metric_name), v_bucket, 1,
    case when coalesce(p_success, false) then 1 else 0 end,
    case when coalesce(p_success, false) then 0 else 1 end,
    v_latency, v_latency, coalesce(p_dimensions, '{}'::jsonb), now()
  )
  on conflict (service_key, metric_name, bucket_start) do update
  set
    sample_count = b.sample_count + 1,
    success_count = b.success_count + case when coalesce(p_success, false) then 1 else 0 end,
    error_count = b.error_count + case when coalesce(p_success, false) then 0 else 1 end,
    latency_sum_ms = b.latency_sum_ms + excluded.latency_sum_ms,
    latency_max_ms = greatest(b.latency_max_ms, excluded.latency_max_ms),
    updated_at = now();
exception
  when others then
    null;
end;
$$;

revoke all on function public.record_live_now_ops_metric(text, text, boolean, integer, jsonb) from public, anon;
grant execute on function public.record_live_now_ops_metric(text, text, boolean, integer, jsonb) to authenticated, service_role;

create or replace function public.upsert_live_now_ops_alert(
  p_dedupe_key text,
  p_severity text,
  p_service_key text,
  p_event_code text,
  p_title text,
  p_details jsonb default '{}'::jsonb,
  p_correlation_id text default null,
  p_resolve boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform public.live_now_ops_require_admin();

  if coalesce(p_resolve, false) then
    update public.live_now_ops_alert_states
    set status = 'RESOLVED',
        resolved_at = now(),
        last_seen_at = now(),
        occurrence_count = occurrence_count + 1
    where dedupe_key = p_dedupe_key
    returning id into v_id;
    return v_id;
  end if;

  insert into public.live_now_ops_alert_states as a (
    dedupe_key, severity, status, service_key, event_code, title, details,
    occurrence_count, first_seen_at, last_seen_at, correlation_id
  ) values (
    p_dedupe_key, upper(p_severity), 'OPEN', lower(p_service_key), upper(p_event_code),
    left(p_title, 200), coalesce(p_details, '{}'::jsonb), 1, now(), now(), p_correlation_id
  )
  on conflict (dedupe_key) do update
  set
    severity = excluded.severity,
    status = case when a.status = 'RESOLVED' then 'OPEN' else a.status end,
    service_key = excluded.service_key,
    event_code = excluded.event_code,
    title = excluded.title,
    details = excluded.details,
    occurrence_count = a.occurrence_count + 1,
    last_seen_at = now(),
    resolved_at = case when a.status = 'RESOLVED' then null else a.resolved_at end,
    correlation_id = coalesce(excluded.correlation_id, a.correlation_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_live_now_ops_alert(text, text, text, text, text, jsonb, text, boolean) from public, anon;
grant execute on function public.upsert_live_now_ops_alert(text, text, text, text, text, jsonb, text, boolean) to authenticated, service_role;

create or replace function public.ack_live_now_ops_alert(p_dedupe_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.live_now_ops_require_admin();
  update public.live_now_ops_alert_states
  set status = 'ACKNOWLEDGED',
      acknowledged_at = now(),
      last_seen_at = now()
  where dedupe_key = p_dedupe_key
    and status = 'OPEN';
  return found;
end;
$$;

revoke all on function public.ack_live_now_ops_alert(text) from public, anon;
grant execute on function public.ack_live_now_ops_alert(text) to authenticated, service_role;

create or replace function public.record_live_now_ops_health_snapshot(
  p_service_key text,
  p_health_status text,
  p_check_kind text default 'AGGREGATE',
  p_details jsonb default '{}'::jsonb,
  p_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform public.live_now_ops_require_admin();
  insert into public.live_now_ops_health_snapshots (
    service_key, health_status, check_kind, details, correlation_id, checked_at
  ) values (
    lower(p_service_key), upper(p_health_status), upper(p_check_kind),
    coalesce(p_details, '{}'::jsonb), p_correlation_id, now()
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_live_now_ops_health_snapshot(text, text, text, jsonb, text) from public, anon;
grant execute on function public.record_live_now_ops_health_snapshot(text, text, text, jsonb, text) to authenticated, service_role;

create or replace function public.bump_live_now_ops_security_counter(
  p_counter_key text,
  p_increment bigint default 1,
  p_dimensions jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
begin
  if p_counter_key is null or char_length(p_counter_key) > 80 then
    return;
  end if;
  insert into public.live_now_ops_security_counters as c (
    counter_key, window_start, count_value, dimensions, updated_at
  ) values (
    lower(p_counter_key), v_window, greatest(coalesce(p_increment, 1), 1),
    coalesce(p_dimensions, '{}'::jsonb), now()
  )
  on conflict (counter_key, window_start) do update
  set
    count_value = c.count_value + excluded.count_value,
    updated_at = now();
exception
  when others then
    null;
end;
$$;

revoke all on function public.bump_live_now_ops_security_counter(text, bigint, jsonb) from public, anon;
grant execute on function public.bump_live_now_ops_security_counter(text, bigint, jsonb) to authenticated, service_role;

create or replace function public.evaluate_live_now_feature_config_consistency()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_flags jsonb := '{}'::jsonb;
  v_violations jsonb := '[]'::jsonb;
  v_flag record;
begin
  perform public.live_now_ops_require_admin();

  for v_flag in
    select flag_key, enabled
    from public.remote_feature_flags
    where flag_key like 'enable%'
  loop
    v_flags := v_flags || jsonb_build_object(v_flag.flag_key, v_flag.enabled);
  end loop;

  -- Impossible configs (remote flags only; client defaults remain fail-closed).
  if coalesce((v_flags->>'enablePublisherExternalIngest')::boolean, false)
     and not coalesce((v_flags->>'enablePublisherStreamManagement')::boolean, false) then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'EXTERNAL_INGEST_WITHOUT_STREAM_MGMT',
      'severity', 'SEV2'
    ));
  end if;

  if coalesce((v_flags->>'enableLiveRecording')::boolean, false) then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'RECORDING_ON_WHILE_EGRESS_BLOCKED',
      'severity', 'SEV2',
      'note', 'LIVEKIT_EGRESS_BLOCKED_INFRASTRUCTURE'
    ));
  end if;

  if coalesce((v_flags->>'enablePublisherPayouts')::boolean, false) then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'PAYOUT_ON_WITHOUT_PROVIDER',
      'severity', 'SEV1',
      'note', 'PAYOUT_PROVIDER_NOT_CONFIGURED'
    ));
  end if;

  if (
       coalesce((v_flags->>'enablePublisherMonetization')::boolean, false)
    or coalesce((v_flags->>'enablePublisherSubscriptions')::boolean, false)
    or coalesce((v_flags->>'enablePublisherDonations')::boolean, false)
  ) then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'MONETIZATION_ON_WITHOUT_PROVIDER',
      'severity', 'SEV1',
      'note', 'PAYMENT_PROVIDER_BLOCKED_PROVIDER_CONFIGURATION'
    ));
  end if;

  if coalesce((v_flags->>'enableLiveModeration')::boolean, false)
     and not coalesce((v_flags->>'enableLiveChat')::boolean, false) then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'MODERATION_WITHOUT_CHAT',
      'severity', 'SEV3'
    ));
  end if;

  if coalesce((v_flags->>'enableGoLive')::boolean, false)
     and not coalesce((v_flags->>'enableLiveNowDiscovery')::boolean, false) then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'GO_LIVE_WITHOUT_DISCOVERY_PARENT',
      'severity', 'SEV3',
      'note', 'allowed_but_inconsistent_product_surface'
    ));
  end if;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_violations) = 0,
    'remote_flag_count', (select count(*) from public.remote_feature_flags),
    'violations', v_violations,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.evaluate_live_now_feature_config_consistency() from public, anon;
grant execute on function public.evaluate_live_now_feature_config_consistency() to authenticated, service_role;

create or replace function public.get_live_now_queue_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_email_pending bigint := 0;
  v_email_retry bigint := 0;
  v_email_failed bigint := 0;
  v_email_oldest interval;
  v_media_pending bigint := 0;
  v_reminder_pending bigint := 0;
begin
  perform public.live_now_ops_require_admin();

  begin
    select
      count(*) filter (where status in ('queued', 'processing')),
      count(*) filter (where status = 'retry_scheduled'),
      count(*) filter (where status = 'failed'),
      min(created_at) filter (where status in ('queued', 'processing', 'retry_scheduled'))
    into v_email_pending, v_email_retry, v_email_failed, v_email_oldest
    from public.email_messages
    where created_at > now() - interval '7 days';
  exception when undefined_table then
    null;
  end;

  begin
    select count(*) into v_media_pending
    from public.publisher_media_jobs
    where status in ('queued', 'running')
      and created_at > now() - interval '7 days';
  exception when undefined_table then
    v_media_pending := 0;
  end;

  begin
    select count(*) into v_reminder_pending
    from public.publisher_stream_schedule_reminders
    where delivery_status = 'pending'
      and scheduled_at <= now() + interval '1 day';
  exception when undefined_table then
    v_reminder_pending := 0;
  end;

  return jsonb_build_object(
    'email', jsonb_build_object(
      'pending_count', coalesce(v_email_pending, 0),
      'retry_count', coalesce(v_email_retry, 0),
      'failed_count', coalesce(v_email_failed, 0),
      'oldest_pending_age_seconds', case
        when v_email_oldest is null then null
        else greatest(0, floor(extract(epoch from (now() - v_email_oldest))))
      end
    ),
    'publisher_media', jsonb_build_object(
      'pending_count', coalesce(v_media_pending, 0),
      'status_note', 'RECORDING_PIPELINE_BLOCKED_INFRASTRUCTURE'
    ),
    'publisher_reminders', jsonb_build_object(
      'pending_due_window_count', coalesce(v_reminder_pending, 0)
    ),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.get_live_now_queue_health() from public, anon;
grant execute on function public.get_live_now_queue_health() to authenticated, service_role;

create or replace function public.get_live_now_ops_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_db text := 'HEALTHY';
  v_email jsonb := '[]'::jsonb;
  v_open_alerts bigint := 0;
  v_queue jsonb;
  v_flags jsonb;
begin
  perform public.live_now_ops_require_admin();

  begin
    perform 1;
  exception when others then
    v_db := 'UNAVAILABLE';
  end;

  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'worker_id', worker_id,
      'status', status,
      'smtp_status', smtp_status,
      'updated_at', updated_at
    )), '[]'::jsonb)
    into v_email
    from public.email_worker_heartbeats
    where updated_at > now() - interval '30 minutes';
  exception when undefined_table then
    v_email := '[]'::jsonb;
  end;

  select count(*) into v_open_alerts
  from public.live_now_ops_alert_states
  where status <> 'RESOLVED';

  v_queue := public.get_live_now_queue_health();
  v_flags := public.evaluate_live_now_feature_config_consistency();

  return jsonb_build_object(
    'checked_at', now(),
    'source', 'get_live_now_ops_status',
    'database', jsonb_build_object(
      'liveness', 'HEALTHY',
      'readiness', v_db,
      'note', 'bounded_probe_only'
    ),
    'services', jsonb_build_object(
      'LIVE_NOW_DISCOVERY', jsonb_build_object('status', 'DISABLED', 'feature_flag', 'enableLiveNowDiscovery', 'certification', 'PHASE1_PARTIAL'),
      'GO_LIVE_CONTROL', jsonb_build_object('status', 'DISABLED', 'feature_flag', 'enableGoLive', 'certification', 'PHASE1_PARTIAL'),
      'LIVEKIT_SFU', jsonb_build_object('status', 'UNKNOWN', 'probe', 'admin_health_edge', 'certification', 'SIGNALING_SEPARATE_FROM_MEDIA'),
      'LIVEKIT_INGRESS', jsonb_build_object('status', 'UNKNOWN', 'certification', 'OBS_REAL_CLIENT_NOT_RUN'),
      'LIVE_CHAT', jsonb_build_object('status', 'DISABLED', 'feature_flag', 'enableLiveChat', 'certification', 'CHAT_TWO_CLIENT_NOT_RUN'),
      'PUBLISHER_ANALYTICS', jsonb_build_object('status', 'DISABLED', 'feature_flag', 'enablePublisherAnalytics', 'certification', 'ANALYTICS_MULTI_VIEWER_NOT_RUN'),
      'RECORDING_PIPELINE', jsonb_build_object('status', 'BLOCKED', 'reason', 'BLOCKED_INFRASTRUCTURE', 'certification', 'NOT_READY'),
      'NOTIFICATIONS', jsonb_build_object('status', 'UNKNOWN', 'depends_on', 'email_worker'),
      'EMAIL_WORKER', jsonb_build_object(
        'status', case
          when jsonb_array_length(v_email) = 0 then 'UNKNOWN'
          when exists (
            select 1
            from jsonb_array_elements(v_email) hb
            where coalesce(hb->>'status', '') = 'healthy'
              and coalesce(hb->>'smtp_status', '') = 'healthy'
          ) then 'HEALTHY'
          when exists (
            select 1
            from jsonb_array_elements(v_email) hb
            where coalesce(hb->>'status', '') in ('degraded', 'starting', 'stopping')
          ) then 'DEGRADED'
          else 'UNKNOWN'
        end,
        'heartbeats', v_email,
        'mailbox_delivery_gate', 'AUTH_INBOX_BLOCKED_RATE_LIMIT'
      ),
      'REMINDER_WORKER', jsonb_build_object('status', 'UNKNOWN', 'note', 'process_liveness_external'),
      'PUBLISHER_APPLICATIONS', jsonb_build_object('status', 'DISABLED', 'feature_flag', 'enablePublisherApplication'),
      'CREATOR_STUDIO', jsonb_build_object('status', 'DISABLED', 'feature_flag', 'enableCreatorStudio', 'certification', 'PARTIAL_RUNTIME_TEAM_CERTIFICATION'),
      'MONETIZATION', jsonb_build_object('status', 'NOT_CONFIGURED', 'reason', 'PAYMENT_PROVIDER_BLOCKED'),
      'KYC_PAYOUT', jsonb_build_object('status', 'NOT_CONFIGURED', 'reason', 'KYC_PAYOUT_PROVIDER_NOT_CONFIGURED')
    ),
    'smtp', jsonb_build_object(
      'connection', 'UNKNOWN',
      'provider_acceptance', 'UNKNOWN',
      'mailbox_delivery', 'BLOCKED_RATE_LIMIT',
      'historical_gate', 'AUTH_INBOX_BLOCKED_RATE_LIMIT'
    ),
    'slo', jsonb_build_object(
      'definitions', 'GO',
      'historical_attainment', 'INSUFFICIENT_OBSERVATION_WINDOW',
      'error_budget', 'NOT_YET_MEASURABLE'
    ),
    'alert_transport', 'NOT_CONFIGURED',
    'open_alerts', coalesce(v_open_alerts, 0),
    'queues', v_queue,
    'feature_config', v_flags,
    'historical_blockers_preserved', jsonb_build_array(
      'REAL_TWO_DESKTOP_MEDIA_NOT_CERTIFIED',
      'AUTH_INBOX_BLOCKED_RATE_LIMIT',
      'OBS_REAL_CLIENT_NOT_RUN',
      'CHAT_TWO_CLIENT_NOT_RUN',
      'ANALYTICS_MULTI_VIEWER_NOT_RUN',
      'LIVEKIT_EGRESS_BLOCKED_INFRASTRUCTURE',
      'MEDIA_STORAGE_BLOCKED_STORAGE_CREDENTIAL',
      'PAYMENT_PROVIDER_BLOCKED_PROVIDER_CONFIGURATION',
      'LIVE_PAYMENT_OFF',
      'LEGAL_BLOCKED_CONTENT_APPROVAL',
      'KYC_PROVIDER_NOT_CONFIGURED',
      'PAYOUT_PROVIDER_NOT_CONFIGURED',
      'LIVE_PAYOUT_OFF',
      'TAX_ENGINE_BLOCKED_LEGAL_PROVIDER_CONFIGURATION',
      'CREATOR_STUDIO_SECURITY_CENTER_PARTIAL_AUTH_PROVIDER_CAPABILITY',
      'CREATOR_STUDIO_PRODUCTION_PARTIAL_RUNTIME_TEAM_CERTIFICATION'
    )
  );
end;
$$;

revoke all on function public.get_live_now_ops_status() from public, anon;
grant execute on function public.get_live_now_ops_status() to authenticated, service_role;

create or replace function public.list_live_now_ops_alerts(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  perform public.live_now_ops_require_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(a) order by a.last_seen_at desc)
    from (
      select id, dedupe_key, severity, status, service_key, event_code, title,
             occurrence_count, first_seen_at, last_seen_at, acknowledged_at, resolved_at, correlation_id
      from public.live_now_ops_alert_states
      order by last_seen_at desc
      limit v_limit
    ) a
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_live_now_ops_alerts(integer) from public, anon;
grant execute on function public.list_live_now_ops_alerts(integer) to authenticated, service_role;

create or replace function public.cleanup_live_now_ops_telemetry(p_retain_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer := least(greatest(coalesce(p_retain_days, 14), 1), 90);
  v_metrics bigint;
  v_health bigint;
  v_counters bigint;
begin
  -- service_role / admin only; no public retention invention beyond operational bound.
  if auth.role() <> 'service_role' then
    perform public.live_now_ops_require_admin();
  end if;

  delete from public.live_now_ops_metric_buckets
  where bucket_start < now() - make_interval(days => v_days);
  get diagnostics v_metrics = row_count;

  delete from public.live_now_ops_health_snapshots
  where checked_at < now() - make_interval(days => v_days);
  get diagnostics v_health = row_count;

  delete from public.live_now_ops_security_counters
  where window_start < now() - make_interval(days => v_days);
  get diagnostics v_counters = row_count;

  return jsonb_build_object(
    'retain_days', v_days,
    'deleted_metric_buckets', v_metrics,
    'deleted_health_snapshots', v_health,
    'deleted_security_counters', v_counters,
    'retention_policy', 'OPERATIONAL_BOUNDED_PENDING_FORMAL_POLICY'
  );
end;
$$;

revoke all on function public.cleanup_live_now_ops_telemetry(integer) from public, anon, authenticated;
grant execute on function public.cleanup_live_now_ops_telemetry(integer) to service_role;

comment on table public.live_now_ops_metric_buckets is 'TASK34 bounded minute metric buckets for Live Now ops. No high-cardinality user labels.';
comment on table public.live_now_ops_alert_states is 'TASK34 deduplicated alert state machine OPEN/ACKNOWLEDGED/RESOLVED.';
comment on function public.get_live_now_ops_status() is 'TASK34 Root/admin Live Now status aggregator. Disabled/not-configured services are never reported HEALTHY.';

commit;
