# Task 46 — Root Dashboard

The single top-level executive/ops view unifying the platform's headline metrics — the "one
screen" for health, growth, safety, cost, and performance — all aggregate.

## Architecture
```
Growth+Retention (19) · Realtime (26) · Perf (38) · Cost (39) · Safety (35/37) · Trends (32)
        └─────────────────────► Root Dashboard (role-scoped tiles) ◄─────────────────────┘
```

## Sections
- **North-star**: activation, active communities, retention.
- **Live**: concurrent users/rooms (26), ingest/error (38).
- **Growth**: acquisition→activation funnel + growth trend (19), download funnel (43).
- **Safety**: risk/fraud queue depth, report SLA (45).
- **Cost/Perf**: spend trend (39), p95 latency, crash-free (38).
- **Signals**: active trends/anomalies (32).

## Data & privacy
- Composes only already-aggregated, k-suppressed marts. No new collection. Role-scoped:
  operators see all; community admins see their slice (via 44). No per-user/content anywhere.

## Database / infra
- Reads existing mart views; no new raw tables (a `dashboard_snapshots` cache is optional).

## APIs / jobs
- Snapshot/caching job for fast load; Realtime tiles subscribe to Task 26.

## Dashboard metrics
- The composite tiles above + data freshness/lag indicator.

## Tests
- Only aggregate sources; role scoping enforced; no per-user drill-through; freshness shown.

## Validation checklist
- [ ] aggregates only · [ ] role-scoped · [ ] no new collection · [ ] freshness surfaced

## Risks / blockers
- Metric sprawl → curate to north-star + a few per domain. Depends on 19/26/32/35/37/38/39/43/44/45.

**Next:** Task 47 — Data Export.
