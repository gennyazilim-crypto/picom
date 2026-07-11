# Community Audit Log and Danger Zone

## Scope

Picom's Community Admin panel provides an owner/admin audit viewer and an owner-only Danger Zone. The supported destructive lifecycle action is recoverable archive, not hard delete.

## Audit contract

- Records show actor, action, target, reason, and timestamp.
- Filters cover actor, target, action, and date range.
- RLS limits reads to members with `viewAuditLog`; normal authenticated clients cannot insert, update, delete, or truncate rows.
- Trusted RPCs append redacted reasons. Corrections are new events rather than mutations.
- Exports are bounded and exclude tokens, passwords, message content, and credentials.

## Ownership transfer

- Current owner only.
- Requires active target membership, a reason, exact-name confirmation, and password reauthentication.
- Community owner, legacy primary role, multi-role links, role audit rows, and append-only audit evidence update atomically.
- Invalid target, bad confirmation, missing role configuration, or any write failure rolls back the full operation.

## Community archive

- Current owner only.
- Requires a reason, exact-name confirmation, and password reauthentication.
- The RPC disables public reads and discovery and records archive actor/time/reason.
- Community content and audit/security records are retained. No renderer hard-delete path exists.

## Backup and recovery impact

- Verify a database backup before risky lifecycle migrations or operations changes.
- Archive does not replace backup: storage objects and database metadata must remain consistent.
- Recovery is an operations-controlled restore after relationship, RLS, storage, Radio, Podcast, and audit continuity checks.
- A failed archive/transfer transaction needs no compensating partial write because PostgreSQL rolls it back atomically.
- Follow `docs/backup-verification.md`, `docs/database-restore-drill.md`, and `docs/rollback-runbook.md` before restoring access.

## Evidence limits

Repository smoke tests validate contracts. Live RLS/pgTAP evidence requires an approved local or staging Supabase CLI context; absence of that environment is reported as blocked, never passed.
