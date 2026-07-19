# Task 49 — Privacy Compliance

The governing layer that ties the platform to GDPR/KVKK obligations: legal bases, data-subject
rights, DPIA, records of processing, and automated compliance checks over the whole intelligence
stack.

## Architecture
```
charter (01) + consent (08/48) + retention (27) + export (47) + anonymization (25)
        └─► compliance controls & checks ──► compliance dashboard + DPIA/RoPA docs
```

## Coverage
- **Legal bases**: analytics = opt-in consent; safety (35/36/37) = legitimate interest;
  rights fulfillment (47) = legal obligation — each documented per module.
- **Data-subject rights**: access, rectification, erasure, restriction, portability, objection —
  wired to Privacy Center (08), Export (47), Retention/erasure (27).
- **DPIA / RoPA**: data-protection impact assessment + records of processing kept current.
- **Automated checks**: CI/lint asserts no Forbidden/content fields in schemas, all categories
  have TTLs, marts are k-suppressed, security data is excluded from analytics.

## Data & privacy
- This module produces governance artifacts + checks; it processes only metadata/audit records
  (48). No new personal data collected.

## Database / infra
- `compliance_checks(check, status, ran_at)`; links to consent_log (48), retention_runs (27).

## APIs / jobs
- Scheduled compliance-check job; DSAR/erasure orchestration; breach-response runbook hooks.

## Dashboard metrics
- Rights-request SLA, check pass rate, categories missing TTL (should be 0), open compliance
  risks.

## Tests
- Static checks: no content/Forbidden fields; every category has TTL; marts k-suppressed;
  security data absent from analytics marts; DSAR/erasure paths exist.

## Validation checklist
- [ ] legal basis per module · [ ] all DSR rights wired · [ ] DPIA/RoPA present
- [ ] automated compliance checks green · [ ] no content/Forbidden fields anywhere

## Risks / blockers
- Regulation drift / cross-border transfer → periodic legal review, region-pinned processing.
  Depends on 01/08/25/27/47/48; gates Final Audit (50).

**Next:** Task 50 — Final Platform Audit.
