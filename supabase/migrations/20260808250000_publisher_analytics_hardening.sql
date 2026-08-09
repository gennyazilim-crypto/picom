-- Publisher Analytics hardening: comments, retention note, least-privilege reaffirm (TASK29).

begin;

comment on function public.join_publisher_stream_viewer_session(uuid, text, text, text, uuid, text) is
  'Authenticated viewer join/reconnect for publisher_streams. Publisher identity cannot join as viewer. Idempotent open session per stream+user.';
comment on function public.record_publisher_viewer_heartbeat(uuid, text) is
  'Credits watch_seconds with max 45s gap; rate-limited. Caller must own the session.';
comment on function public.leave_publisher_stream_viewer_session(uuid, text) is
  'Ends viewer session and credits final heartbeat gap.';
comment on function public.finalize_publisher_stream_analytics(uuid) is
  'Idempotent stream finalization: closes sessions, aggregates chat/follows/notifications, writes summary.';
comment on function public.get_publisher_analytics_overview(integer) is
  'Publisher-owned aggregate overview. Range capped to 90 days. dashboard.read does not grant access.';
comment on function public.get_publisher_stream_analytics(uuid, boolean) is
  'Publisher-owned stream analytics. include_internal requires root.';

-- Retention: no automatic deletion worker. Documented as RETENTION_POLICY_PENDING.
comment on table public.publisher_analytics_events is
  'Append-oriented publisher live analytics events. RETENTION_POLICY_PENDING — no destructive cleanup worker.';

-- Reaffirm: no table grants to authenticated/anon for raw analytics.
revoke all on table public.publisher_analytics_events from public, anon, authenticated;
revoke all on table public.publisher_viewer_sessions from public, anon, authenticated;
revoke all on table public.publisher_stream_health_samples from public, anon, authenticated;
revoke all on table public.publisher_stream_analytics_summaries from public, anon, authenticated;
revoke all on table public.publisher_analytics_minute_buckets from public, anon, authenticated;
revoke all on table public.publisher_analytics_rate_limits from public, anon, authenticated;

grant all on table public.publisher_analytics_events to service_role;
grant all on table public.publisher_viewer_sessions to service_role;
grant all on table public.publisher_stream_health_samples to service_role;
grant all on table public.publisher_stream_analytics_summaries to service_role;
grant all on table public.publisher_analytics_minute_buckets to service_role;
grant all on table public.publisher_analytics_rate_limits to service_role;

commit;
