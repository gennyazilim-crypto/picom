# Task 37 — Fraud Detection

Detects coordinated/automated abuse (bot rings, spam waves, mass-join, self-boosting) by
combining Account (35) + Device (36) risk with graph/velocity analysis.

## Architecture
```
account_risk (35) + device_risk (36) + join/message velocity + membership graph
        └─► pattern/graph detectors ──► fraud_signals ──► moderation queue / auto-throttle
```

## Detectors
- Shared-device/network clusters, synchronized join bursts, spam velocity, reaction/boost
  rings, social-auth handoff replay/rate-limit abuse.

## Data & privacy
- **Security legal basis**, content-blind (metadata + security signals). Short retention
  (≤180d). Adverse actions are human-reviewed or reversible auto-throttles, never silent
  permanent bans without appeal.

## Database / infra
- `fraud_signals(cluster_id, type, members, confidence, detected_at)` (security RLS).

## APIs / jobs
- Scheduled + near-real-time detectors; moderation dashboard; throttle hooks.

## Dashboard metrics
- Active fraud clusters, blocked abuse volume, precision (confirmed/actioned), appeal rate.

## Tests
- Synthetic bot-ring detected; legitimate bursts not flagged (guardrails); content-blind;
  human-in-the-loop; ≤180d.

## Validation checklist
- [ ] security basis · [ ] metadata/security only · [ ] human review + appeal
- [ ] reversible throttles · [ ] ≤180d

## Risks / blockers
- Collateral damage on legit surges → confidence thresholds, allowlists, review. Depends on
  35/36, integrates with Admin Intelligence (45).

**Next:** Task 38 — Performance Observability.
