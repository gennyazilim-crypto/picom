# Backup verification workflow

## Status

Picom includes guarded automation that can restore a **staging backup** into a generated temporary development or staging database, run read-only integrity checks, and remove only that generated database. It is safe plan/smoke mode by default and does not connect without `--execute` plus explicit staging confirmations.

Do not run against production. Do not place database passwords, backup contents, service-role keys, access tokens or real connection URLs in Git, command history, docs, logs or screenshots.

## Safe commands

No database access:

```text
npm run backup:verify:placeholder
npm run backup:verify:smoke
```

Automated staging-only execution requires PostgreSQL client tools (`createdb`, `psql`, `pg_restore` for custom dumps, `dropdb`) and protected environment configuration:

```powershell
$env:PICOM_BACKUP_VERIFY_CONFIRM="staging-temporary-restore"
$env:PICOM_BACKUP_VERIFY_SOURCE="staging"
$env:PGHOST="127.0.0.1"
$env:PGPORT="5432"
$env:PGUSER="staging_restore_operator"
$env:PGPASSWORD="<protected environment only>"
$env:PGDATABASE="postgres"
npm run backup:verify:automated -- --backup C:\protected\staging-backup.dump
```

For a remote staging host, additionally require `PICOM_BACKUP_VERIFY_ALLOW_STAGING=true`; the host must be explicitly named staging/test/dev. Production-like host/database names are rejected. Use a dedicated least-privilege staging restore operator and isolated database server whenever possible.

## Automated behavior

1. Validate backup file and staging-only confirmations.
2. Reject production-like target, arbitrary maintenance database, and unsafe remote host.
3. Check PostgreSQL client tools.
4. Generate `picom_restore_verify_<timestamp>_<random>`; no caller-supplied target DB name.
5. Create temporary DB and restore SQL with `psql` or custom/archive dump with `pg_restore`.
6. Verify `profiles`, `communities`, `channels`, `messages`, `community_members`, `roles`, `attachments`.
7. Record staging row counts.
8. Run read-only relationship/owner/permissions/default-role/clientMessageId integrity checks.
9. Detect optional `audit_log` without modifying it.
10. In `finally`, use `dropdb --force` only for the generated prefix-matched database.

This verifies database metadata, not Supabase Storage object bytes, Auth provider behavior, Realtime, Edge Functions, LiveKit or full desktop usability. Run separate staging application/storage smoke after DB verification.

## Manual fallback

Use when client tools are unavailable or provider restore tooling must be used:

1. Obtain Operations/Database approval and record staging target/backup checksum/time.
2. Create an isolated temporary DB through provider console/approved tooling.
3. Restore without changing production or source backup.
4. Run read-only table/count/relationship queries from `docs/database-restore-drill.md` and `scripts/check-data-integrity.mjs` guidance.
5. Run Auth/community/channel/message/upload/private-access/Realtime staging smoke.
6. Verify Storage objects separately from attachment metadata.
7. Record durations, counts, errors, backup/tool versions and decision with redaction.
8. Remove target only after exact non-production identity and approval are reconfirmed.

Never improvise a production restore or cleanup command from this fallback.

## Failure policy

- Mark backup unverified and block risky migration/release.
- Preserve redacted stage/tool/error evidence; do not include credentials or data.
- Do not retry destructively until cause (backup corruption, version/tool mismatch, permissions, storage, schema drift) is understood.
- Escalate through incident response if production recoverability is in doubt.
- If automatic temp DB cleanup fails, contact the staging DB owner immediately; do not broaden a delete command.

## Required recurring evidence

- Monthly during beta and before risky migration; quarterly stable placeholder.
- Backup checksum/source timestamp and restore-tool/Postgres versions.
- Restore duration, integrity counts/result, application/storage smoke, cleanup and approvers.
- No backup is “verified” solely because it exists or a smoke script passes.

Production deployment and rollback decisions reference this workflow, the restore drill, incident response and post-restore reconciliation policy.
