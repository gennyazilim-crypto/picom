# Task 34 — Sentiment-Safe Analytics

A deliberately **constrained** module: infer community "mood/health" only from **behavioral
proxies** (reaction mix, churn, report rate), explicitly **not** from reading or classifying
message text.

## Architecture
```
reaction-type mix + engagement + churn + report-rate (aggregate) ──► health index ──► dashboards
```

## Why no NLP on content
- Message text is Forbidden data; running sentiment models on user messages would violate
  the privacy charter (Task 01) and content-blind principle. This module documents that
  boundary and offers a compliant alternative.

## Signals (content-blind)
Positive/negative **reaction** ratios (emoji categories), retention vs churn, report/mute
rates, activity trend — all aggregate counts.

## Data & privacy
- No text analysis, no per-user sentiment, k-suppressed community grain only.

## Database / infra
- `community_health(community_id, index, features, computed_at)`.

## APIs / jobs
- Rollup job; admin dashboard read.

## Dashboard metrics
- Health index trend, reaction-mix, churn/report signals.

## Tests
- Assert no text/NLP path exists; aggregate only; k-suppressed; no per-user sentiment.

## Validation checklist
- [ ] no content/NLP on messages · [ ] behavioral proxies only · [ ] community grain
- [ ] k-suppressed

## Risks / blockers
- Pressure to "just analyze messages" → explicitly out of scope per charter. Uses
  Warehouse (23).

**Next:** Task 35 — Account Risk Scoring.
