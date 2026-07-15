# Task 13 — Spam & Bot Detection

Production build of the detection design in [../SECURITY_ENGINE.md](../SECURITY_ENGINE.md).
Behavioral, content-blind; legitimate-interest.

## Architecture
```
action events + rate-limit hits ──► Event Bus ──► detectors (velocity, duplication-rate,
                                                   link-ratio, timing-regularity, burst)
                                                          │  scores → risk band
                                                          ▼
                                    graduated response: throttle → challenge → timeout → ban
                                    └─► moderation queue (Task 18) · trust update (Task 12)
```

## Signals (content-blind)
Message/invite/DM **velocity** (counts), duplicate-rate bucket, link ratio (count of links,
not URLs), inter-action timing regularity, new-account burst, salted-IP signup velocity.
**No** message text, URLs stored as content, audio, or video.

## Database
- `abuse_signals(id, subject_type, subject_id, signal, score_bucket, created_at)` — no raw
  IP/content; service-role write, aggregate read.
- Reuse `consume_current_user_action_rate_limit` + `social_auth_rate_limits` (salted).

## APIs / jobs
- Detectors run in the Event Bus consumer (near-real-time) + a batch sweep job.
- RPC surfaces flags to moderators (redacted excerpt only).

## Dashboard metrics
- Spam/bot signal rate, action mix (throttle/timeout/ban), FP-appeal rate, precision proxy.

## Tests
- Velocity threshold triggers; graduated escalation; salted bucketing (no raw IP); reversal
  (unban/untimeout); no content field.

## Config & deploy
- Thresholds + kill switch in remote config. Migration for `abuse_signals`.

## Validation checklist
- [ ] content-blind · [ ] graduated + reversible · [ ] salted-hash, no raw IP
- [ ] human review before permanent action · [ ] observable

## Risks / blockers
- Adversarial adaptation → layered signals + human review. Feeds Trust (12), Moderation
  (18), Account/Device risk (35/36).

**Next:** Task 14 — Feed Ranking AI.
