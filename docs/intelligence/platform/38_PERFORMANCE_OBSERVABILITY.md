# Task 38 — Performance Observability

Client + edge performance monitoring (latency, errors, crash-free rate, LiveKit/voice call
quality) from **technical** telemetry — no user identity, no content.

## Architecture
```
perf_metric / error_event (timings, codes, Task 02) ──► warehouse ──► perf dashboards + alerts
edge/function logs (Supabase) ──────────────────────────┘
```

## Metrics
- App start time, route/render timings (CWV-style), API/edge latency buckets, error/crash
  rate, voice-call connect success + `LIVEKIT_NOT_CONFIGURED`/token-failure rates,
  update-check success (electron-updater).

## Data & privacy
- Durations/sizes as **buckets**, error codes/types (no messages with PII), no user id, no
  content. Sampled. Aggregate-only dashboards.

## Database / infra
- `perf_metrics(metric, bucket, value, ts)`, `error_events(type, code, count, ts)`; joins
  Supabase edge logs (ops-scoped).

## APIs / jobs
- Rollups; alerting on SLO breach; feeds Trend Detection (32).

## Dashboard metrics
- p50/p95 latency, error rate, crash-free %, call-connect success, update success.

## Tests
- No PII/content in error payloads; buckets only; sampled; aggregate.

## Validation checklist
- [ ] technical telemetry only · [ ] no identity/content · [ ] buckets + sampling
- [ ] SLO alerts

## Risks / blockers
- Error strings leaking PII → sanitize/allowlist codes. Feeds Ops dashboards, Trend (32).

**Next:** Task 39 — Cost Analytics.
