# Task 27 — Retention Engine

Enforces the retention schedule from [../DATA_RETENTION.md](../DATA_RETENTION.md) as
automated, auditable jobs across staging, marts, logs, security signals, and handoffs.

## Architecture
```
scheduler ──► retention jobs (per category TTL) ──► delete/anonymize ──► audit log
```

## Policies enforced (from Task 09)
- Staging raw events ≤30d; marts aggregates ≤25mo; security signals ≤180d; rate-limit &
  social-auth handoff short/single-use; logs ring-buffer; consent records account+≤3y.

## Data & privacy
- Deletes or irreversibly anonymizes on expiry; erasure requests cascade immediately
  (account-deletion Edge Functions). Idempotent; every run audited.

## Database / infra
- Uses partition drops + TTL predicates; `retention_runs(category, deleted, anonymized,
  ran_at)` audit table.

## APIs / jobs
- Scheduled per-category jobs; on-demand erasure trigger from Privacy Center (Task 08).

## Dashboard metrics
- Rows deleted/anonymized per category, oldest-row age per category (SLA), job success.

## Tests
- TTL boundary deletes; erasure cascade completeness; idempotency; audit written.

## Validation checklist
- [ ] every category has an enforced TTL · [ ] erasure cascades · [ ] idempotent + audited
- [ ] oldest-row SLA monitored

## Risks / blockers
- Backups converge to deletion within backup horizon (documented). Central for compliance
  (48/49).

**Next:** Task 28 — Search Analytics.
