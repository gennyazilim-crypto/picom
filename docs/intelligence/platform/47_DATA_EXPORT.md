# Task 47 — Data Export

Two distinct export paths kept strictly separate: (a) **GDPR/KVKK subject-access export** of a
user's own data, and (b) **analytics/report export** of aggregate marts for admins/operators.

## Architecture
```
(a) user request ──► DSAR builder (own data, RLS) ──► signed, expiring bundle ──► user
(b) admin request ──► aggregate report export (k-suppressed marts) ──► CSV/JSON
```

## Subject-access (a)
- User exports **their own** profile, memberships, messages they authored, consent history —
  scoped by RLS to `auth.uid()`. Delivered as a downloadable bundle via a short-lived signed
  URL. Ties to Privacy Center (08) + erasure (27).

## Analytics export (b)
- Admins export **aggregate** marts only (already k-suppressed). No raw events, no per-user
  rows, no content. Community admins limited to their community (44).

## Data & privacy
- (a) is the data subject's own data on legal basis of rights fulfillment. (b) is aggregate.
  **Never** allow (b) to leak individual data. Every export is audited (48). No PII in
  filenames/URLs.

## Database / infra
- `export_jobs(id, type, requester, scope, status, expires_at)`; storage bucket with signed,
  expiring links.

## APIs / jobs
- DSAR builder job; aggregate export job; link-expiry cleanup.

## Dashboard metrics
- Export requests by type, fulfillment time (DSAR SLA), failures.

## Tests
- DSAR returns only requester's data (RLS); analytics export has no per-user rows; links
  expire; audited; no PII in URL.

## Validation checklist
- [ ] DSAR self-scoped · [ ] analytics export aggregate/k-suppressed · [ ] signed expiring links
- [ ] audited · [ ] no PII in URLs

## Risks / blockers
- Mixing the two paths = breach → enforce separate code paths + tests. Depends on Privacy
  Center (08), Consent Audit (48), Retention (27).

**Next:** Task 48 — Consent Audit.
