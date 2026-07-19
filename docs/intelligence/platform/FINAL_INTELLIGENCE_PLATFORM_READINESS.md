# Task 100 — Final Intelligence Platform Readiness (Tasks 01–99)

Audit date: 2026-07-15 · Target: live `piso` (Picom prod, eu-central-1) · Evidence: verified
live queries + committed migrations (see AUDIT_52_100_PROD_COVERAGE.md for the per-task map).

## Verdict: **CONDITIONAL GO** for the current frontend-beta scope
The intelligence/data platform itself is deployed, privacy-first, and operating (jobs running,
checks green, security advisory clean). "GO" is conditional because launch-critical items that
live OUTSIDE this platform (below) remain operator-owned.

## What is live and verified (this program)
- **Ingestion works end-to-end:** consent-gated `record_analytics_event` → sanitization (key
  denylist + value-level PII redaction) → queue drained every minute (was: 542 stuck / 6 days
  stale) → daily rollup scheduled → data-quality checks hourly.
- **Privacy spine:** taxonomy governance + CI gate; pseudonymous identity (salted sha256, salt
  server-only); k-anonymity accessor; deletion propagation completeness (+ checker fn); silver
  accessor exposes no raw ids; consent enforcement fail-closed (pre-existing, verified).
- **Safety intelligence:** coordinated-abuse + ATO detectors (no raw IP stored), trend anomaly
  detection, content-quality + creator-reputation scoring (metadata-only).
- **Ops:** SLO checker, cost ledger, realtime counters (1-min), 4 active cron jobs, DR runbook,
  residency strategy, sub-processor register, fairness-review template, model-governance tables.
- **Security:** critical anon-key RLS gap closed (5 tables); every object added by this program
  has RLS + pinned search_path (certified by query, none missing).

## Launch blockers (CRITICAL/HIGH — must close before public launch)
| # | Blocker | Owner | Severity |
|---|---|---|---|
| 1 | T99 hosted multi-user acceptance not yet executed (checklist ready) | Operator | CRITICAL |
| 2 | SMTP/verification email not provisioned → sign-up flow incomplete | Operator | CRITICAL |
| 3 | ~~Client emitters not wired~~ **CLOSED**: legacy `analyticsService.trackEvent` now bridges into the canonical `analyticsQueue` (CANONICAL_BRIDGE; enforced by the taxonomy validator) | — | done |
| 4 | ~~T56 minimization~~ **FUNCTION DEPLOYED** (0 rows modified); only the weekly `cron.schedule` one-liner remains a deliberate operator action | Operator (one line) | LOW |
| 5 | Backups: PITR off (Pro-plan gate) → RPO 24h | Operator | HIGH |
| 6 | ~~Taxonomy validate not in CI~~ **CLOSED**: `qa.yml` now runs `intelligence:event-schema:smoke` + `intelligence:taxonomy:validate` | — | done |

## Risk register (accepted/monitored)
- Prod schema diverges from local repo (built by a second codebase) → all future DB work must be
  audit-first (this program's method); repo migrations are the DR source of truth.
- Heuristic (SQL) scoring, not trained models → honest v1; model path scaffolded (T83/85/87/88),
  serving (T84) is an infra decision.
- 300 pre-existing WARN advisories (security-definer exec lints, function search_path on legacy
  fns, 1 rls_enabled_no_policy, leaked-password protection off) → triage in 30-day plan.
- Low data volume (beta) makes several analytics return empty until usage grows — correct, not broken.

## 30 / 60 / 90-day operational plan
**30d:** close blockers 1–4; wire client emitters; add taxonomy+DQ checks to CI; triage the WARN
advisory backlog (start with `auth_leaked_password_protection` and `rls_enabled_no_policy`);
first quarterly DR drill.
**60d:** enable PITR (Pro); provision LiveKit (EU) for voice beta; feed cost ledger from provider
meters; first fairness review against a scoring release; review k/thresholds with real volume.
**90d:** evaluate T84 model serving vs staying heuristic (traffic-dependent); external privacy/DPIA
review; retention re-check (first data crosses the 180d minimization window ~2026-12).

## Not marked done (honesty ledger)
T84 model serving, T94 PITR, T99 execution, LiveKit/SMTP/OAuth provisioning, CI wiring — these
require infrastructure, plan tier, or live humans; runbooks/checklists are delivered but the work
itself is not claimed.
