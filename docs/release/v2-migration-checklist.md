# Picom v2 migration checklist

Use this checklist before promoting the Picom v2 Electron desktop release on Windows, Linux, and macOS. Every `[BLOCKER]` requires dated evidence and an owner; unchecked blockers mean No-Go. Never place credentials, connection strings, backup contents, user data, service-role keys, worker secrets, or signed URLs in this record.

## Release record

- Version / channel / RC commit:
- Migration range and checksum:
- Previous production schema marker:
- Minimum/recommended desktop versions:
- Database owner / release owner / security reviewer:
- Window, rollback deadline, incident channel:
- Decision: `Go` / `Go with non-blockers` / `No-Go` / `Delay`

## 1. Inventory and review

- [ ] `[BLOCKER]` Exact ordered SQL migration list is captured from the previous production marker through the RC commit; no manual production SQL is omitted.
- [ ] `[BLOCKER]` `20260710088000_user_data_export_production.sql`, `20260710089000_account_deletion_production.sql`, and `20260710089100_account_deletion_anonymization.sql` are reviewed with their Edge Function/type changes.
- [ ] `[BLOCKER]` DDL, indexes, constraints, RLS grants/policies, security-definer functions, function grants, and Storage changes receive database and security review.
- [ ] `[BLOCKER]` Destructive/irreversible operations are absent or have explicit backup, restore, user-impact, approval, and forward-fix evidence.
- [ ] `[VERIFY]` Generated database types match the applied schema; no renderer imports database entities containing secrets.
- [ ] `[BLOCKER]` Account deletion finalization remains disabled until Legal/Operations approve it; no unreviewed schedule or worker secret is configured.

## 2. Backup and restore evidence

- [ ] `[BLOCKER]` Fresh provider backup/snapshot timestamp, retention, checksum/reference, and owner are recorded outside Git.
- [ ] `[BLOCKER]` `npm run backup:verify:smoke` passes.
- [ ] `[BLOCKER]` A recent isolated staging restore verification follows [backup verification](../backup-verification.md) and [database restore drill](../database-restore-drill.md).
- [ ] `[BLOCKER]` Restored profiles, communities, channels, messages, attachments, roles/permissions, and audit/security events pass read-only integrity checks.
- [ ] `[VERIFY]` Supabase Storage object recovery is verified separately; DB backup alone does not restore attachment bytes.
- [ ] `[BLOCKER]` Restore RTO/RPO, approver, and cleanup evidence are recorded without credentials.

## 3. Local and clean database migration

- [ ] `[BLOCKER]` Migrations apply in order to a clean disposable database.
- [ ] `[BLOCKER]` Migrations apply from the exact previous release schema/data shape.
- [ ] `[BLOCKER]` Failure/partial-apply behavior is tested; corrective migration is additive and idempotent.
- [ ] `[VERIFY]` Index creation/locks and table rewrite duration fit the approved maintenance window.
- [ ] `[VERIFY]` Seed data is development/staging-only and is not part of production deployment.
- [ ] `[BLOCKER]` `npm run supabase:smoke` and applicable RLS tests pass; structural smoke does not substitute for live RLS evidence.

## 4. Staging migration and application smoke

- [ ] `[BLOCKER]` Staging backup is captured before migration, then the exact RC migrations/functions/config are deployed.
- [ ] `[BLOCKER]` [staging smoke test](../staging-smoke-test.md) passes for register/login/session restore, community/channel, messages, reactions, uploads, two-client Realtime, voice/screen share where enabled, and logout.
- [ ] `[BLOCKER]` Owner/admin/mod/member/visitor and cross-community/private-channel denial tests pass for SQL, REST, Realtime, Storage, search, export, and attachments.
- [ ] `[BLOCKER]` User data export returns only authenticated own/RLS-visible allowlisted data and honors expiry/no-store behavior.
- [ ] `[BLOCKER]` Account deletion rejects wrong confirmation and owned communities, revokes sessions, allows grace-period cancellation, and does not run finalization while disabled.
- [ ] `[VERIFY]` Health/readiness, logs/metrics, rate limits, job queues, Storage and Realtime show no regression after migration.

## 5. Desktop and local-data compatibility

- [ ] `[BLOCKER]` Last supported desktop version and v2 RC both work against migrated staging; API/Realtime changes are additive or explicitly gated.
- [ ] `[BLOCKER]` Minimum/recommended client metadata and compatibility headers match [API compatibility policy](../api-compatibility.md).
- [ ] `[BLOCKER]` Windows, Linux, and macOS RC startup/login/chat smoke passes; no mobile UI or web-first fallback is introduced.
- [ ] `[BLOCKER]` Settings schema `3` and coordinated local-data manifest `2` migrate from empty, legacy, corrupted, and current values per [client migration](../client-local-data-migration.md).
- [ ] `[VERIFY]` Drafts survive valid migration, corrupt draft/cache scopes reset independently, auth/session data is untouched, and Safe Mode recovers storage failures.
- [ ] `[BLOCKER]` Downgrade behavior is documented: older clients must ignore additive DB fields; local settings downgrade is not assumed reversible.

## 6. Rollback and forward-fix decision

- [ ] `[BLOCKER]` Review [rollback runbook](../rollback-runbook.md); classify each migration as code-rollback-compatible, forward-fix-only, or restore-required.
- [ ] `[BLOCKER]` Previous backend/Edge Function bundle remains compatible with expanded schema before any desktop/backend rollback.
- [ ] `[BLOCKER]` No down migration is assumed to restore deleted/transformed data; verified backup is the only approved restore source.
- [ ] `[VERIFY]` Feature flags/kill switches can pause affected entry points without weakening backend/RLS enforcement.
- [ ] `[BLOCKER]` Pause thresholds and authority are set for auth/message errors, RLS denial/leak, migration locks, Realtime failure, crash rate, or data-integrity alarms.

## 7. Production execution

- [ ] `[BLOCKER]` Go/No-Go sign-offs from Engineering, Database/Operations, Security, Product, and Legal where deletion/privacy behavior is involved.
- [ ] `[BLOCKER]` Pause desktop rollout and non-essential writers if required; announce maintenance/degraded state using approved communication.
- [ ] `[BLOCKER]` Apply only reviewed migrations from protected release source; record start/end/version/result without secrets.
- [ ] `[BLOCKER]` Deploy compatible Edge Functions/config after their required schema exists; do not enable deletion finalization worker.
- [ ] `[BLOCKER]` Run safe production smoke with dedicated accounts: health, auth, community/channel, message, private denial, upload, Realtime, export request metadata.
- [ ] `[VERIFY]` Monitor database errors/locks/connections, RLS denials, auth/message success, Realtime, Storage and desktop crashes through the rollback window.

## 8. Closeout

- [ ] `[BLOCKER]` Migration marker, evidence links, unresolved issues, owners/dates and final decision are attached to the release record.
- [ ] `[VERIFY]` Release notes describe user-visible migration impact and recovery guidance without internal/security details.
- [ ] `[VERIFY]` Support receives known issues and [incident response](../incident-response.md) escalation path.
- [ ] `[VERIFY]` Backup retention and temporary staging resources are cleaned only after identity/approval checks.
- [ ] `[VERIFY]` Post-deploy review confirms no unauthorized data exposure, missing rows, duplicate sends, stale sessions, or client compatibility regression.

## Linked release controls

- [Data migration strategy](../data-migration-strategy.md)
- [Production deployment checklist](../production-deployment-checklist.md)
- [Release candidate dry run](../release-candidate-dry-run.md)
- [Rollback runbook](../rollback-runbook.md)
- [Backup verification](../backup-verification.md)
- [Staging smoke test](../staging-smoke-test.md)
- [API compatibility](../api-compatibility.md)
- [Client local-data migration](../client-local-data-migration.md)
- [Go/No-Go checklist](../go-no-go-checklist.md)
