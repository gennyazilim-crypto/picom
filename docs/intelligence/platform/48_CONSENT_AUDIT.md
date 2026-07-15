# Task 48 — Consent Audit

Immutable, queryable audit trail proving **what** each user consented to, **when**, and that
collection/processing honored it — the evidentiary backbone for compliance (49).

## Architecture
```
consent change (Privacy Center 08) ──► append-only consent_log ──► audit queries/reports
processing/export/erasure actions ──► action audit ──────────────┘
```

## What is recorded
- Consent tier + version, grant/withdraw timestamp, scope (analytics, marketing, etc.),
  policy version accepted; plus append-only audit of exports (47), erasures (27), and admin
  access (45).

## Data & privacy
- Append-only (no updates/deletes) so history is tamper-evident; user-scoped read (own
  history) + operator/compliance read. Stores decisions/metadata, **not** the analytics
  content itself. Retention: account lifetime + ≤3y (Task 09).

## Database / infra
- `consent_log(user_id, tier, version, action, scope, ts)` append-only (revoke via trigger,
  no hard update); `processing_audit(actor, action, target, ts)`.

## APIs / jobs
- Consent-write hook from Privacy Center; audit-query API (compliance); integrity check job.

## Dashboard metrics
- Consent opt-in rates by tier, withdrawals, audit completeness, integrity-check status.

## Tests
- Append-only enforced (no update/delete path); consent change recorded; erasure/export
  audited; user reads only own history.

## Validation checklist
- [ ] append-only/tamper-evident · [ ] consent + processing recorded · [ ] user self-read
- [ ] decisions/metadata only · [ ] retention bounded

## Risks / blockers
- Audit table itself is personal data → covered by DSAR/erasure with legal-hold exception.
  Feeds Privacy Compliance (49), used by Data Export (47).

**Next:** Task 49 — Privacy Compliance.
