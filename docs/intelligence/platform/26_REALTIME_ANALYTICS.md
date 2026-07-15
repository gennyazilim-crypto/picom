# Task 26 — Realtime Analytics

Low-latency aggregate counters (active users now, live rooms, ingest rate, error rate) for
ops and creator "live" views — aggregate, no per-user tracking.

## Architecture
```
Event Bus (22) ──► streaming aggregator (windowed counters) ──► realtime store (short TTL)
                                                                 └─► live dashboards (Supabase Realtime)
```

## Metrics
- Concurrent sessions (approx, pseudonymous), live voice rooms, messages/min (count),
  ingest/error rate, active communities now.

## Data & privacy
- Sliding-window **counts** only; no identity, no content; short retention (minutes/hours);
  small live audiences suppressed (k-anonymity).

## Database / infra
- `realtime_counters(metric, window, value, updated_at)` TTL-short; updated by the stream
  consumer; served over Supabase Realtime to authorized dashboards.

## APIs / jobs
- Stream consumer updates counters; dashboard subscribes; compaction/TTL job.

## Dashboard metrics
- The counters themselves + freshness/lag.

## Tests
- Windowed counts correct on synthetic stream; no identity/content; TTL enforced;
  suppression for small live cells.

## Validation checklist
- [ ] aggregate counters only · [ ] short TTL · [ ] no per-user/content · [ ] k-suppressed

## Risks / blockers
- Approximation vs exactness → documented as estimates. Depends on Event Bus (22).

**Next:** Task 27 — Retention Engine.
