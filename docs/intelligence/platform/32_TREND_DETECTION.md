# Task 32 — Trend Detection

Detects unusual movement in **aggregate** metrics (activity spikes/drops, growth anomalies)
and raises signals — statistics over counts, never over content.

## Architecture
```
marts time-series (23) ──► anomaly/trend detector (rolling stats) ──► trend signals ──► dashboards/alerts
```

## Methods
- Rolling mean/stddev z-score, week-over-week deltas, simple seasonal baselines on
  aggregate series (activity, joins, messages/min, retention).

## Data & privacy
- Operates only on already-aggregated, k-suppressed series. No content, no per-user data.
  Signals reference metrics/segments, not individuals.

## Database / infra
- `trend_signals(metric, segment, direction, magnitude, detected_at)`.

## APIs / jobs
- Scheduled detector over marts; feeds Realtime (26) and admin/ops alerts.

## Dashboard metrics
- Active trend signals, false-positive rate (ack'd), biggest movers.

## Tests
- Known synthetic spike detected; steady series → no signal; operates on aggregates only.

## Validation checklist
- [ ] aggregate series only · [ ] no content/per-user · [ ] signals reference metrics
- [ ] tunable sensitivity

## Risks / blockers
- Alert fatigue → thresholds + de-dup. Depends on Warehouse (23), feeds Realtime (26).

**Next:** Task 33 — Topic Clustering.
