# Task 11 — AI Recommendation Engine (Platform)

Production build of the design in [../RECOMMENDATION_ENGINE.md](../RECOMMENDATION_ENGINE.md).
Content-blind, consent-gated, explainable. Preserves existing Picom architecture
(Supabase + Edge Functions + renderer service layer).

## Architecture
```
consented events (Task 02 queue) ──► Event Bus (Task 22) ──► feature store (Task 23)
public catalog + relationships (Supabase) ──┐
personalization profile (device, Task 03) ──┼─► retrieval ─► scorer (linear) ─► post-process
recommendations feedback (shown/accepted/dismissed) ──┘        (diversity, fatigue, safety filter)
                                                        └─► `recommendations` API ─► UI (+"why?")
```

## Data & privacy
- Signals: affinities, popularity/recency buckets, social proof, language, safety score.
  **Never** message/DM content, audio, video, contact books.
- Gated by `recommendations`/`personalization` consent; personal terms zeroed when off →
  popularity/recency fallback (fully functional).

## Database changes
- `recommendation_feedback(user_id, item_type, item_id, slot, decision, created_at)` — RLS:
  owner-only; decisions only, no content.
- `recommendation_candidates` materialized view (public communities/podcasts/radio + activity buckets), refreshed by a job.

## APIs (Edge Functions / RPCs)
- `get_recommendations(domain, limit)` — returns ranked items + reason codes; JWT-scoped.
- `record_recommendation_feedback(item, decision)` — rate-limited, consent-checked.

## Background jobs
- Candidate refresh (15 min); fatigue/affinity decay (daily); popularity rollups (hourly).

## Dashboard metrics
- CTR by domain/slot, accept/dismiss rate, coverage, diversity, fallback-vs-personalized ratio.

## Tests
- Ranking determinism given fixed signals; consent-off zeroes personal terms; safety filter
  excludes blocked/muted/reported; no content field in any payload (schema smoke pattern).

## Config & deploy
- Weights in remote config (kill-switchable); deploy candidate view + functions via Supabase.

## Validation checklist
- [ ] content-blind (no message/DM/audio/video signal) · [ ] consent-gated + fallback
- [ ] explainable reason codes · [ ] safety filter · [ ] RLS owner-scoped feedback
- [ ] observable metrics · [ ] deterministic tests

## Risks / blockers
- Cold-start sparsity (mitigated by popularity fallback); needs Event Bus (Task 22) +
  warehouse (Task 23) for scale; sink/transport stays OFF until configured.

**Next:** Task 12 — Trust Score System.
