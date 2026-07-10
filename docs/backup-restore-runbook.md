# Picom Backup and Restore Runbook

## Purpose and safety boundary

Protect Supabase Postgres/Auth data and understand the separate recovery needs of Storage, Edge Functions, LiveKit configuration, desktop releases, and secret stores.

This repository does not automatically back up or restore production. Never run a restore against production by default, never paste credentials into commands/docs, and never claim a backup is verified until a staged restore drill succeeds.

## Data inventory

| Data/component | Primary system | Backup/recovery consideration |
| --- | --- | --- |
| Auth users/sessions | Supabase Auth/Postgres managed schemas | Confirm provider backup scope and session behavior after restore |
| Profiles/communities/members/roles/channels/messages/reactions/read state/attachment metadata | Supabase Postgres | Managed backup/PITR plus tested staging restore |
| Attachment objects | Supabase Storage | Object data/lifecycle is separate from Postgres metadata backup |
| RLS/functions/triggers/schema | Versioned SQL migrations | Repository commit plus deployed migration history |
| Edge Functions | Repository source + deployment versions | Redeploy known-good commit/function bundle |
| Function/provider secrets | Supabase/production secret stores | Secret manager backup/rotation policy; never repository dump |
| LiveKit rooms/media | LiveKit runtime | Ephemeral; recover configuration/credentials, not live media |
| Desktop settings/cache/drafts | User device | Local migration/safe-mode policy; not restored from server DB backup |
| Desktop installers | Release artifact store | Checksums/provenance and previous known-good artifact retained |

## Backup policy gate

The current tier/cost/retention decision record is `docs/supabase-backup-pitr-review.md`. Production plan
selection remains pending approval; do not assume PITR is active. Database backup does not include Storage
object bytes or replace configuration/function/secret recovery.

Before production launch, record provider plan/features for automated backups/PITR, retention, region, encryption, access owners, restore limitations, and alerting. Verify the plan covers the selected Supabase tier and database size; do not assume PITR or retention is enabled.

Before every risky migration:

1. Confirm latest successful backup timestamp belongs to the target project.
2. Confirm backup/PITR retention covers the rollback window.
3. Confirm last restore drill is within the approved interval.
4. Record schema/migration version and safe row-count baseline.
5. Confirm Storage object recovery separately.
6. Name restore/incident/communication owners.

Missing evidence blocks the migration.

## Restore target selection

Restore first to a new isolated staging/temporary project/database. It must have:

- A clearly non-production target/project ref and connection.
- Different secrets, OAuth callbacks, email/notification behavior, LiveKit project, and public URLs.
- Outbound email/notifications/webhooks disabled or safely redirected.
- Restricted operator access and a cleanup approval.
- Sufficient storage/resources for the backup.

Never validate restoration by overwriting the only production database.

## Staging restore sequence

1. Open an approved drill/change record and identify backup timestamp/source.
2. Verify target twice and disable outbound side effects.
3. Restore with the Supabase/provider-supported workflow appropriate to the plan/tier.
4. Record start/end time and redacted provider operation ID.
5. Confirm migration history and RLS enabled state.
6. Run read-only integrity queries and orphan checks.
7. Verify Auth login/session reset expectations with synthetic accounts.
8. Point a staging desktop build to the restored target using staging-safe values.
9. Run community/channel/message, role/private access, attachment metadata, Realtime, and Edge Function smoke.
10. Verify Storage objects separately; missing objects despite metadata are a failed full recovery.
11. Produce a redacted report and clean up only after explicit non-production target verification.

## Storage recovery

- Postgres attachment rows do not restore object bytes by themselves.
- Record Storage bucket/object backup/export/versioning capability and retention separately.
- During drill, compare attachment metadata counts/path samples with authorized object existence checks.
- Keep `message-attachments` private after recovery and reverify policies/signed URL behavior.
- Do not bulk expose objects or regenerate public links to “fix” recovery.
- Orphan cleanup remains dry-run until recovery evidence is complete.

## Auth and secrets after restore

- Do not reuse production OAuth/provider/LiveKit/email credentials in restored staging.
- Restore/rotate server secrets through the approved secret manager; never from logs or DB dumps.
- Expect active sessions/refresh tokens to require revocation or reauthentication depending on the incident/restore point.
- Verify auth triggers/profile consistency without sending real email.

## Restore failure

1. Stop and mark backup unverified.
2. Preserve redacted provider/tool errors and immutable backup source.
3. Determine corruption, truncation, encryption/key, version/tool, permission, capacity, or schema mismatch.
4. Try another approved restore point only under drill/incident approval.
5. Do not proceed with risky migration or stable release.
6. Update incident, risk register, owners, and next drill date.

## Production recovery decision

Production restore can cause data loss since the restore point. Incident leadership must compare outage/corruption impact with recovery-point loss and choose restore, point-in-time recovery, failover, or forward repair. Freeze writes where possible, preserve evidence, communicate uncertainty honestly, and verify desktop/backend compatibility before reopening traffic.

## Drill frequency

- Before initial stable launch.
- Before high-risk/destructive migration.
- At least quarterly after launch, or the stricter approved policy.
- After provider/tier/region/tooling/schema ownership changes.
- After any failed backup or restore evidence.

## Task 404 drill update

Guarded backup/restore tooling, maintenance safety, PITR review, and migration recovery contracts passed on 2026-07-10. No staging database was opened, backed up, restored, migrated, or destructively modified. The real drill remains blocked; use `docs/backup-restore-destructive-lifecycle-drill.md` and `docs/data-integrity-checklist.md` for execution.

## Task 414 real drill result

A real synthetic staging export was created with schema/public/Auth-Storage/role dumps and a SHA-256 manifest. Restore did not complete: a raw Supabase Postgres image lacked a compatible managed Auth schema, and the local Supabase target port was occupied by an unrelated project that was intentionally left untouched. Treat provider-managed Auth/Storage schema version compatibility and circular message/DM/thread foreign keys as required restore-plan items.