# Task 16 — Creator Analytics

Analytics for community owners / radio & podcast creators about **their own** content
performance — aggregate audience metrics, never per-listener surveillance or content mining.

## Architecture
```
consented interaction counts (plays, opens, reactions, follows, retention)
   ▼ scoped to creator's own communities/shows
creator rollups ─► Creator dashboard (audience size, growth, engagement, retention)
```

## Signals (aggregate)
Plays/completions (buckets), followers/subscribers growth, reaction/comment **counts**,
retention cohort, active-hours of the **audience in aggregate**. **No** individual listener
identity, no message/audio content, no cross-creator data.

## Database
- `creator_metrics(owner_id, entity_type, entity_id, metric, value, period, ...)` — RLS:
  owner reads own entities only. Populated by rollup job.

## APIs / jobs
- RPC `get_creator_metrics(entity)` (owner-scoped). Hourly/daily rollups from Event Bus.

## Dashboard metrics
- Audience size, growth rate, completion-rate buckets, top episodes/programs (own), retention.

## Tests
- Owner-only RLS (cannot read others'); counts/buckets only; deterministic rollups.

## Config & deploy
- Migration for `creator_metrics` + RPC + rollup job.

## Validation checklist
- [ ] owner-scoped · [ ] aggregate/no listener identity · [ ] content-blind · [ ] observable

## Risks / blockers
- Small-audience re-identification → suppress metrics below a k-anonymity threshold
  (Task 25). Feeds Radio (41)/Podcast (42) analytics.

**Next:** Task 17 — Premium AI Insights.
