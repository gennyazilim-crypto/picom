# Task 44 — Community Insights

Owner/admin-facing analytics **for their own community** — growth, activity, retention,
channel health — scoped by RLS so an admin only ever sees their space, always aggregate.

## Architecture
```
marts (23) + quality (31) + growth/retention (19) ──► per-community views (RLS) ──► Community Insights UI
```

## Metrics
- Member growth/churn, active-member rate, messages/reactions/voice activity (counts),
  top channels (health score 31), retention curve, join sources (aggregate).

## Data & privacy
- Community-scoped **aggregates only**; never exposes individual member behavior or content.
  Enforced by RLS keyed to community ownership/roles (reuses the roles/RLS schema). k-suppressed
  small segments.

## Database / infra
- `community_insights(community_id, metric, value, period)`; RLS: owner/admin of that
  community only.

## APIs / jobs
- Per-community rollup; UI read via RLS-protected views.

## Dashboard metrics
- Growth, activity, retention, channel health — for the admin's community.

## Tests
- Admin of A cannot read B's insights (RLS); aggregates only; no per-member drill-down;
  k-suppressed.

## Validation checklist
- [ ] community-scoped RLS · [ ] aggregate only · [ ] no per-member/content exposure
- [ ] k-suppressed

## Risks / blockers
- Small communities → suppression may hide most cells (documented, expected). Uses
  Warehouse (23), Quality (31), Growth Analytics (19).

**Next:** Task 45 — Admin Intelligence.
