# Database migration rollback/forward drill

## Current execution result - 2026-07-10

Status: **BLOCKED / NOT RUN**. This environment has no approved staging project, verified backup/PITR
recovery point, operator approval, or Supabase CLI. No database command was executed. The procedure below
is prepared for an isolated staging target and must not be relabeled as a completed drill.

## Purpose and safety boundary

Prove that Picom can move from the previous release schema to a candidate migration, detect a regression,
choose a data-safe recovery path, validate the recovered schema/application, then reapply a corrected forward
path. Production is never a drill target. Never delete Migration history rows, run a linked reset, improvise a
down migration, or assume schema reversal restores transformed/deleted data.

## Required people and evidence

- Database/operator, migration author/reviewer, security/RLS reviewer, desktop QA, incident/rollback owner.
- Exact previous and candidate commit/migration range plus checksums.
- Approved staging project fingerprint, explicitly different from production.
- Verified backup gate: recent staging backup/PITR point, retention, redacted ID, restore capability, and
  successful representative restore drill.
- Expected lock/rewrite duration, affected tables/rows, desktop compatibility window, and stop thresholds.
- Outbound email/webhook/notification/LiveKit side effects disabled or redirected in staging.

## Migration classification before execution

| Class | Examples | Preferred recovery |
| --- | --- | --- |
| Additive/reversible | New nullable column/table/index, unused additive policy | Compensating migration if explicitly reviewed; code rollback may remain compatible |
| Data-transforming | Backfill, type conversion, constraint tightening, RLS rewrite | Forward-fix; preserve expanded schema and disable feature if needed |
| Destructive/irreversible | Drop/delete, lossy transform, overwritten values | Restore/PITR after approved data-loss-window decision |

Every migration must be tagged `code-rollback-compatible`, `forward-fix-only`, or `restore-required`. If
classification is uncertain, stop before apply.

## Timed staging drill

### 1. Isolate and baseline

1. Record staging fingerprint and confirm it differs from production with two operators.
2. Freeze schema writers and disable outbound side effects.
3. Capture migration list, schema/RLS/Storage/Realtime inventories, safe row counts, current desktop/API
   compatibility version, and health metrics.
4. Run structural checks and the previous Windows, Linux, and macOS desktop candidate against staging.

### 2. Verified backup gate

1. Capture a managed backup/PITR point or approved logical staging backup before migration.
2. Confirm backup timestamp precedes apply and retention exceeds the drill window.
3. Verify Storage objects separately; database backup restores metadata, not object bytes.
4. Stop if backup identity, target, restore procedure, or last drill evidence is uncertain.

### 3. Apply candidate migration

1. Review dry-run diff and exact SQL from the protected release commit.
2. Apply only the candidate range to staging through the approved Supabase workflow.
3. Record start/end/duration and redacted provider operation/migration versions.
4. Stop on partial apply, unexpected lock, timeout, row-count drift, policy change, or integrity alert.

### 4. Validate migrated state

- Migration list/checksum, schema constraints/indexes/triggers/functions and generated types.
- RLS owner/admin/moderator/member/visitor, cross-community, private-channel, attachment and Storage denial.
- Auth/session/profile, community/channel/message/reaction/upload, two-client Realtime, Edge Functions, and
  data-integrity checks.
- Previous supported desktop plus candidate desktop compatibility on Windows, Linux, and macOS.
- Error/lock/connection/latency metrics against baseline.

### 5. Exercise the approved recovery branch

Choose one branch in the drill record before execution:

**Compensating migration:** For truly reversible additive DDL, apply a new higher-numbered reviewed migration
that neutralizes the candidate without deleting migration history. Validate old/new clients and RLS again.

**Forward-fix:** Keep compatible expanded schema, disable affected feature if needed, apply an additive and
idempotent corrective migration, and verify data invariants. This is the default for most deployed changes.

**Restore/PITR:** For destructive corruption, freeze writes, record the accepted recovery point/data-loss
window, restore into the isolated staging target through provider tooling, reconcile migrations and Storage,
rotate/recreate staging-only configuration, and measure RPO/RTO. Never restore over production in this drill.

### 6. Validate recovered state

Repeat the entire schema/RLS/integrity/core-app/Realtime/Storage/Edge/desktop matrix. Compare safe counts to
the baseline and explain all differences. A provider job marked successful is insufficient if app/private
access or Storage reconciliation fails.

### 7. Reapply and roll forward

From the recovered previous-release state, apply the corrected candidate path again, repeat validation, and
prove the latest migration history is linear and reproducible. Record whether production remains Go/No-Go.

### 8. Cleanup and evidence

Revoke synthetic sessions, remove only the independently verified staging target/artifacts allowed by
retention policy, preserve the source backup, and store redacted timings/RPO/RTO/results/owners in the private
operations record. Never store connection strings, refs, credentials, row content, JWTs, or signed URLs.

## Pass/fail criteria

- **Pass:** backup is verified, candidate applies, chosen recovery succeeds, full validation passes, corrected
  roll-forward succeeds, and measured RPO/RTO meet approved targets.
- **Fail:** migration/recovery/integrity/private access/core desktop flow fails or unexplained data drift exists.
- **Blocked:** target, backup, CLI/provider access, approval, synthetic identities, or platform QA is missing.

## References

- `docs/supabase-backup-pitr-review.md`
- `docs/backup-verification.md`
- `docs/database-restore-drill.md`
- `docs/data-migration-strategy.md`
- `docs/rollback-runbook.md`
- `docs/supabase/production-migration-dry-run.md`
- `docs/staging-smoke-test.md`
