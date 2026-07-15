# Task 14 — Feed Ranking AI

Ranks the unified feed (followed + discovery) for relevance without reading content.
Consent-gated personalization with a non-personalized recency fallback.

## Architecture
```
candidate items (followed authors, ranked feed, community activity)
   │  features: recency, engagement bucket, author affinity, card-type affinity, safety score
   ▼
ranker (linear, explainable) ─► diversity/fatigue ─► feed order  ─► "why?" per item
feedback: feed_card_opened / dwellBucket (Task 02) ─► affinity + fatigue
```

## Data & privacy
- Features are metadata (recency, counts, followed-set, card type, safety). **No** post
  text, images, DM, audio, video. Impression/dwell as **buckets**.
- `personalization` consent → tailored; off → reverse-chronological + popularity.

## Database
- Reuse `list_ranked_unified_feed`; add `feed_engagement(user_id, card_type, dwell_bucket,
  decision, created_at)` (owner RLS, buckets only).

## APIs / jobs
- Ranking computed server-side per request (or edge-cached); affinity decay job (daily).

## Dashboard metrics
- Feed CTR, dwell distribution, scroll-depth buckets, diversity, fallback ratio.

## Tests
- Deterministic order for fixed features; consent-off = chronological; safety demotion;
  no content field.

## Config & deploy
- Weights in remote config (kill-switch). Migration for `feed_engagement`.

## Validation checklist
- [ ] content-blind · [ ] consent-gated + chronological fallback · [ ] explainable
- [ ] safety-filtered · [ ] observable

## Risks / blockers
- Filter-bubble/freshness → guaranteed fresh slice + diversity caps. Shares infra with
  Recommendations (11).

**Next:** Task 15 — Community Health Score.
