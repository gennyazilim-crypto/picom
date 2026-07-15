# Task 12 — Trust Score System

A per-account, content-blind reputation score driving graduated trust (posting limits,
verification prompts, moderation weighting). Legitimate-interest (safety); no consent
toggle, but fully explainable and appealable.

## Architecture
```
Required security/behavior signals (Task 06) ──► Event Bus ──► trust scorer (decayed weighted sum)
account facts (age, verification, mod history) ──┘                     │
                                                                       ▼
                                             trust_score band (new/limited/normal/trusted)
                                             └─► gates (rate limits, invite caps, mod weight)
```

## Signals (content-blind)
Account age, email/social verification, successful sessions, community standing, report
rate **against** the user, ban/timeout history, spam/bot signals (Task 13), device risk
(Task 36). **No** message content, DM graph, audio, or video.

## Database
- `account_trust(user_id PK, score numeric, band text, updated_at)` — RLS: self-read own
  band only; full row service-role. Decayed; recomputed on signal.
- Append-only `trust_events(user_id, kind, weight, created_at)` — salted where needed.

## APIs / jobs
- RPC `get_my_trust_band()` (self, coarse band only — never the raw score to the user).
- Job: nightly decay + recompute; on-write incremental update via Event Bus.

## Dashboard metrics
- Band distribution, transitions, correlation with abuse outcomes (aggregate).

## Tests
- Monotonicity (good behavior ↑, abuse ↓); band thresholds; decay; RLS prevents reading
  others' scores; no content signal.

## Config & deploy
- Weights/thresholds in remote config (kill-switchable). Migration for tables + RPC.

## Validation checklist
- [ ] content-blind · [ ] explainable + appealable · [ ] self sees only coarse band
- [ ] decayed/recency-aware · [ ] RLS-scoped · [ ] observable

## Risks / blockers
- Fairness/false-positives → coarse bands + human appeal, never auto-permanent. Feeds
  Spam/Bot (13), Moderation (18), Fraud (37).

**Next:** Task 13 — Spam & Bot Detection.
