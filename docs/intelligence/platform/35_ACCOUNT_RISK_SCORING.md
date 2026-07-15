# Task 35 — Account Risk Scoring

Trust & Safety scoring of accounts for abuse likelihood using behavioral + security signals,
under a **legitimate-interest** legal basis distinct from the opt-in analytics consent.

## Architecture
```
signup pattern + rate-limit hits + report/mute received + social-auth handoff anomalies
        └─► risk features ──► account_risk score ──► moderation queue / step-up auth
```

## Signals
- Velocity (rapid signups/joins), rate-limit violations (reuses `consumeSocialAuthRateLimit`
  table), reports/mutes received, handoff-nonce anomalies, device-risk (Task 36).
- **No message content.** Metadata + security events only.

## Data & privacy
- Legal basis: **legitimate interest / safety**, not the analytics opt-in — documented in
  Consent/Compliance (48/49). Minimal retention (security signals ≤180d, Task 09). Owner &
  admin access controlled; user-facing transparency per policy. Decisions are advisory to
  human moderators, not fully automated bans (GDPR Art. 22 consideration).

## Database / infra
- `account_risk(user_id, score, reasons, updated_at)` (admin RLS); reuses existing
  rate-limit + report tables.

## APIs / jobs
- Scoring job; moderation dashboard read; optional step-up-auth trigger.

## Dashboard metrics
- Score distribution, high-risk queue size, action outcomes, false-positive rate.

## Tests
- No content used; legitimate-interest basis documented; human-in-the-loop for adverse
  actions; retention ≤180d; admin-scoped.

## Validation checklist
- [ ] safety legal basis (not analytics consent) · [ ] metadata/security signals only
- [ ] human-in-the-loop for bans · [ ] ≤180d retention · [ ] admin-scoped

## Risks / blockers
- Bias/false positives → human review, appeal path, reason codes. Depends on Device
  Risk (36), feeds Fraud Detection (37).

**Next:** Task 36 — Device Risk Engine.
