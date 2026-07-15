# Task 17 — Premium AI Insights

Paid-tier insight bundles for creators/admins built **only** on aggregate, consented
metrics from other modules — no new data collection, no content mining.

## Architecture
```
Creator (16) + Community Health (15) + Growth (19) + Trend (32) rollups
   ▼ (entitlement check)
insight generator (templated + optional LLM over labels/counts) ─► Premium dashboard
```

## Data & privacy
- Reuses existing aggregate metrics; **no** message/DM/audio/video, no per-user drill-down.
- Optional LLM phrasing receives only counts/labels; outputs ephemeral, not training.
- Entitlement (premium) gates access; consent still required for underlying data.

## Database
- `premium_entitlements(user_id, tier, valid_until)` — RLS self-read. No new analytics tables.

## APIs / jobs
- RPC `get_premium_insights(scope)` — entitlement + consent checked. Precompute job reuses
  other modules' rollups.

## Dashboard metrics
- Insight usage, entitlement conversion, retention of premium users (aggregate).

## Tests
- Entitlement gate; consent gate; no content in inputs/outputs; owner/admin scoping.

## Config & deploy
- Entitlement source of truth in billing; migration for entitlements table.

## Validation checklist
- [ ] no new collection · [ ] content-blind · [ ] entitlement + consent gated · [ ] scoped

## Risks / blockers
- Must not become a pretext to collect more; audited in Task 48/49. Billing integration is
  a separate concern (out of scope here).

**Next:** Task 18 — AI Moderation.
