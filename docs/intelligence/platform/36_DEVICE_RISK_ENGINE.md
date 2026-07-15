# Task 36 — Device Risk Engine

Derives coarse device/session risk signals for abuse prevention **without device
fingerprinting for tracking** — hashed, bucketed, security-scoped, not used for analytics.

## Architecture
```
session/auth metadata ──► salted-hash + bucket ──► device_risk signals ──► Account Risk (35)
```

## Signals (privacy-bounded)
- Salted-hashed IP→network bucket, coarse geo-region mismatch, session velocity, new-device
  flag, impossible-travel heuristic. **No raw IP stored**, no persistent tracking id, no ad
  fingerprint.

## Data & privacy
- Legal basis: **security/legitimate interest** (not analytics consent). Salt is server-only
  (Task 25). Short retention (≤180d). Never fed into product analytics/marts. Never used to
  target or profile for non-security purposes.

## Database / infra
- `device_risk(session_hash, signals, ts)` (admin/security RLS); raw IP never persisted.

## APIs / jobs
- Auth-time enrichment; risk aggregation feeding Task 35.

## Dashboard metrics
- Risk-signal rates, new-device rate, impossible-travel flags (aggregate).

## Tests
- No raw IP persisted; salted non-reversible; not present in analytics marts; security-scoped;
  ≤180d.

## Validation checklist
- [ ] no raw IP/fingerprint stored · [ ] salted non-reversible · [ ] security use only
- [ ] excluded from analytics marts · [ ] ≤180d

## Risks / blockers
- Line between security signal and tracking → strict separation from analytics, security-only
  access. Feeds Account Risk (35), Fraud (37).

**Next:** Task 37 — Fraud Detection.
