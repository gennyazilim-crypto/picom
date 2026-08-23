# Evidence manifest — TASK 13C.1 PHASE A

No DB passwords, service-role keys, JWTs, or user PII.

| File | Purpose |
|---|---|
| 00-summary.md | Verdict |
| preflight.md | Gate checklist |
| migration-fingerprint.txt | SHA256 |
| production-target.json | Target proof |
| hosted-contract-before.json | Legacy 3-arg snapshot |
| schema-precheck.json | Column presence |
| data-baseline.json | Aggregate counts |
| sql-review.md | Every DDL statement |
| client-contract.md | Client + types |
| consumer-check.md | Live callers |
| recovery-gate.md | Backup/PITR |
| rollback-plan.md | Prepared rollback SQL |
| apply-mechanism.md | Scoped apply path |
| local-rehearsal.md | Docker/pgTAP |
| suites/onboarding_rpc-contract_smoke.txt | Smoke output |
| git-status-before.txt | Dirty tree before |
| git-status-after.txt | Dirty tree after |
| manifest.md | This file |
