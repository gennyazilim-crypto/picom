# Publisher Analytics Architecture

## Domain
Publisher live analytics is keyed to `publisher_streams.id`.

## Tables
- `publisher_analytics_events` — append-only, unique `idempotency_key`
- `publisher_viewer_sessions` — authenticated viewer sessions + watch_seconds
- `publisher_stream_analytics_summaries` — live + finalized aggregates
- `publisher_analytics_minute_buckets` — concurrent timeseries
- `publisher_stream_health_samples` — optional health samples
- `publisher_analytics_rate_limits` — join/heartbeat abuse controls

## Ingestion
- Client RPCs: join / heartbeat / leave (own session only)
- LiveKit webhook → `service_record_publisher_analytics_livekit_event`
- Finalizer → `finalize_publisher_stream_analytics` (also triggered on terminal stream status)
- Bridge: `resolve_publisher_stream_id_for_live_session` maps community live session → publisher stream

## Client wiring
- Live Watch joins analytics session only after actual room join path and only when flag ON + linked stream
- Heartbeat interval 25s; leave on unmount/end
- Creator Studio polls lightweight live aggregate every 15s (not historical rollups)

## Watch-time algorithm
On heartbeat/leave, credit `min(elapsed_seconds, 45)`.
Stale sessions close after 90s without heartbeat; credit capped at 45s beyond last heartbeat.

## Concurrent viewers
Count open sessions where `left_at is null` and `last_heartbeat_at >= now() - 90s` and `internal_test = false`.
Peak is max concurrent observed via live refresh.

## Privacy
Raw events/sessions are not granted to authenticated clients.
Publishers read aggregates via RPC only.
Internal/test profiles in `platform_stats_exclusions` are excluded from public aggregates.
RETENTION_POLICY_PENDING — no automatic destructive cleanup.

## Feature flag
`enablePublisherAnalytics` — production fail-closed OFF.
