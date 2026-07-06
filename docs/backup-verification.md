# Backup Verification Workflow

Picom production data must not rely on untested backups. This workflow documents how to verify database backups by restoring them into a temporary development or staging database and running basic integrity checks.

This is a placeholder workflow. Do not run against production by default. Do not store real credentials in scripts, docs, commits, logs, or screenshots.

## Goals

- Confirm backup files can be restored.
- Confirm core tables exist after restore.
- Confirm basic row counts can be inspected.
- Destroy temporary verification databases only when explicitly safe.
- Document restore failures before a production migration or rollback decision.

## Placeholder script

Use:

```bash
npm run backup:verify:placeholder -- --backup path/to/backup.dump
```

By default, the script does not restore anything. It prints the intended verification plan and requires explicit development-only confirmation before a future implementation could run destructive temporary database actions.

Required future confirmation placeholder:

```bash
$env:PICOM_BACKUP_VERIFY_CONFIRM="development-only"
npm run backup:verify:placeholder -- --backup path/to/backup.dump
```

## Intended verification behavior

A future implementation should:

1. Accept a backup file path.
2. Refuse production connection strings by default.
3. Create a temporary development database with a unique name.
4. Restore the backup into that temporary database.
5. Run read-only integrity checks.
6. Verify core tables exist:
   - `users`
   - `communities`
   - `channels`
   - `messages`
   - `community_members`
   - `roles`
   - `attachments`
   - `audit_logs`
7. Record placeholder row counts for users, communities, messages, attachments, roles, and audit logs.
8. Run smoke queries for recent messages and community/channel relationships.
9. Destroy the temporary database only after explicit confirmation that it is not production.
10. Write a redacted verification summary.

## Read-only integrity checks

Recommended checks after restore:

- Users table exists.
- Communities table exists.
- Channels table exists and every channel has a community.
- Messages table exists and every message has a valid channel.
- Community members have valid users and communities.
- Roles exist for each community or a documented default-role policy exists.
- Attachments have valid message references.
- Audit logs load and are not modified by verification.

## Safety rules

- Never point the verification script at production by default.
- Never include database passwords in command examples.
- Never auto-delete databases unless a generated temporary database name is verified.
- Never mutate restored data beyond the restore itself.
- Never publish row counts if they reveal sensitive business information without approval.
- Always verify backup before risky production migrations.

## Failure handling

If verification fails:

1. Mark the backup as not verified.
2. Do not proceed with risky production migration.
3. Capture redacted logs and failing command stage.
4. Check whether backup file is corrupt, incomplete, or incompatible with current restore tooling.
5. Escalate through `docs/incident-response.md` if production data safety is at risk.

## Release checklist integration

Production deployment must treat backup verification as a blocker before risky migrations. See `docs/production-deployment-checklist.md` and `docs/rollback-runbook.md`.
