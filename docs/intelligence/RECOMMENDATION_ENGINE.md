# Picom Intelligence Engine — Recommendation Engine

**Task 04 · recommendations for communities, podcasts, radio, feed, and friends.** Uses
consented signals only (Task 01/03) and existing surfaces (Discovery, unified feed,
audio catalog, friend suggestions). **No message/DM content, audio, or video is used as
a ranking signal.**

## Principles
- **Consent-aware**: personalized ranking uses the `personalization` / `recommendations`
  consents. Without them, recommendations fall back to **non-personalized** popularity/
  recency (still fully functional, just not tailored).
- **Explainable**: every ranked item carries a machine-readable reason
  (`"popular_in_your_language"`, `"similar_to_favorites"`, `"new_this_week"`,
  `"friends_joined"`) surfaced in the UI as "Why am I seeing this?".
- **Content-blind**: signals are affinities, counts, buckets, recency, and public metadata
  — never private content or who-you-DM.
- **Diversity & safety**: results are de-duplicated, capped per source, exclude
  blocked/muted/reported entities, and demote low-quality/abusive items (Task 06).

## Candidate sources
| Domain | Candidates | Public/consented signals |
|---|---|---|
| Communities | public + joinable | member-count bucket, recent activity, language, category, your community-affinity |
| Podcasts | catalog episodes/shows | recency, popularity bucket, category, your content-type affinity |
| Radio | live/scheduled sessions | live-now, schedule proximity, popularity, your affinity |
| Feed | followed + ranked unified feed | recency, engagement bucket, followed authors, card-type affinity |
| Friends | non-friends, non-blocked | mutuals count, shared communities, follow overlap (no DM graph) |

## Ranking model (two-stage, explainable)
1. **Retrieval** — gather candidates per domain (already-loaded/public data), filter out
   blocked/muted/self/already-joined/duplicates and low-quality items.
2. **Scoring** — linear, interpretable weighted sum:
   ```
   score = w_recency·recency
         + w_popularity·popularityBucket
         + w_affinity·personalAffinity      // 0 when consent off
         + w_social·socialProof             // mutuals / friends joined
         + w_language·languageMatch
         - w_penalty·(staleness + fatigue)  // demote seen/dismissed
   ```
   Weights are constants (tunable, documented), not a black box. `personalAffinity` and
   `socialProof` are **zeroed** when the corresponding consent is off → graceful,
   non-personalized fallback.
3. **Post-processing** — diversity (cap per author/community/category), freshness mix
   (guaranteed slice of "new"), and impression fatigue (decay repeatedly-shown items).

## Feedback loop
- `feed_card_opened`, recommendation `shown/accepted/dismissed` (Task 02, consented) feed
  fatigue and affinity — **decisions and slots only, never content**.
- Dismiss ("not interested") strongly demotes similar candidates for a decay window.

## Friend suggestions (privacy-critical)
- Signals: **mutual friends count**, **shared community membership**, **follow overlap** —
  all already-visible relationship facts. **Never** DM history, contact books, or content.
- Excludes blocked/blocking, already-friends, and users who opted out of discoverability
  (`profilePrivacyService`).

## Guarantees & consumers
- Content-blind, consent-gated, explainable, safety-filtered; auditable in Task 10.
- Fallback path guarantees usable recommendations with **zero** personal data.
- Timing/surfacing coordinated with the AI assistant digest
  ([AI_ASSISTANT_ENGINE.md](./AI_ASSISTANT_ENGINE.md), Task 05) and personalization profile
  ([PERSONALIZATION_ENGINE.md](./PERSONALIZATION_ENGINE.md), Task 03).
