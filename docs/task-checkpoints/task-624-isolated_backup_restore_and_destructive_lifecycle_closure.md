# Task 624 Checkpoint - Isolated Backup Restore and Destructive Lifecycle

Date: 2026-07-12
Overall result: **PARTIAL / BLOCKED**

## Passed

- Immutable synthetic backup hashes match Task 414 evidence.
- Provider roles, schema, public data and Auth/Storage metadata restore without ignored errors.
- Profiles equal Auth users at 27; core V1 table counts are recorded.
- Measured relationship/orphan checks are zero.
- Sensitive-table RLS and private Storage bucket posture remain intact.
- Outsider private channel/message/DM reads return zero; participant DM reads pass.
- Message-delete and invite-revoke RPCs pass.
- Thirteen rollback-scoped database lifecycle assertions pass.
- Forward/fix DDL path passes.
- No production system, existing container or existing port was touched.
- Temporary containers and fixtures are removed.

## Blocked

- Storage object bytes and private object access were not restored/tested.
- A running isolated GoTrue service did not verify revoked or already-issued token behavior.
- Restored-target Electron/API/Realtime/Edge smoke did not run.
- Production backup/PITR ownership and recovery SLA remain unapproved.

## Commands

- `Get-FileHash -Algorithm SHA256 <synthetic backup files>`
- guarded Docker restore with `ON_ERROR_STOP`
- `scripts/v1-isolated-backup-restore-drill.ps1 -ConfirmSyntheticStaging`
- task-specific SQL RLS/integrity/lifecycle assertions

Database recoverability improved materially, but unresolved full-recovery risk keeps RB-11 and stable V1 release blocked.
