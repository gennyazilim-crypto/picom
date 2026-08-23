# Worker Deployment Inventory — TASK 07

Docker engine was **not running** during this audit (`dockerDesktopLinuxEngine` missing).  
Therefore: **no immutable digests**, **no SBOM**, **no vulnerability scan evidence**, **HOSTED WORKER E2E: BLOCKED**.

| Worker | Source | Dockerfile / unit | Image digest | Production deploy |
| --- | --- | --- | --- | --- |
| email-worker | `infra/email/*` | `infra/email/Dockerfile` + systemd unit | BLOCKED_NO_IMMUTABLE_DIGEST | NOT STARTED |
| event-reminder-worker | `infra/email/picom-event-reminder-worker.service` | unit only | BLOCKED | NOT STARTED |
| advertising-scheduler | code/jobs tables exist; dedicated image missing | — | BLOCKED_IMAGE_NOT_BUILT | NOT STARTED |
| ad-reconciliation-worker | ledger SQL + regressions | — | BLOCKED_IMAGE_NOT_BUILT | NOT STARTED |
| invalid-traffic-worker | planned | — | BLOCKED_IMAGE_NOT_BUILT | NOT STARTED |
| payout-worker | domain + `scripts/payout-worker-security-regression.mjs` | — | BLOCKED_IMAGE_NOT_BUILT | NOT STARTED |
| payout-reconciliation-worker | domain + regressions | — | BLOCKED_IMAGE_NOT_BUILT | NOT STARTED |
| transparency-archive-worker | archive SQL | — | BLOCKED_IMAGE_NOT_BUILT | NOT STARTED |
| retention-cleanup-worker | planned | — | BLOCKED_IMAGE_NOT_BUILT | NOT STARTED |

## Deploy rules

- Never deploy `:latest` to production.
- Require non-root user, health/readiness, lease/heartbeat, retry/backoff, dead-letter, graceful shutdown.
- Keep processing disabled until Stage 1 canary + mutation guard PASS.

## Honest status

Presence of job tables or worker **scripts** is **not** worker E2E PASS.
