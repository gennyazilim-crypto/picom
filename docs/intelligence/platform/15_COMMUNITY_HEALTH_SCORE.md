# Task 15 — Community Health Score

A per-community, content-blind health metric for admins (activity, retention, safety,
growth) — aggregate, never surveilling individual members' content.

## Architecture
```
community activity counts + membership deltas + moderation/abuse rates + retention cohort
   ▼
health scorer (normalized composite) ─► health band + subscores ─► Community Insights (44) / Admin (45)
```

## Signals (aggregate, content-blind)
Active-member ratio, message/reaction **counts**, new-join/leave rate, retention cohort,
report/mod-action rate, response latency buckets. **No** message content, no per-member
profiling for surveillance.

## Database
- `community_health(community_id PK, score, activity, safety, growth, retention, updated_at)`
  — RLS: community admins read their own; recomputed by job.

## APIs / jobs
- RPC `get_community_health(community_id)` (admin-scoped). Nightly recompute + on-write deltas.

## Dashboard metrics
- Score trend, subscore breakdown, at-risk communities, cohort retention curves.

## Tests
- Composite bounds; admin-only RLS; counts-only inputs; deterministic recompute.

## Config & deploy
- Weights in config. Migration for `community_health` + RPC.

## Validation checklist
- [ ] aggregate/content-blind · [ ] admin-scoped RLS · [ ] explainable subscores · [ ] observable

## Risks / blockers
- Gaming by admins → include safety/retention, not just volume. Feeds Community Insights
  (44), Admin Intelligence (45), Root Dashboard (46).

**Next:** Task 16 — Creator Analytics.
