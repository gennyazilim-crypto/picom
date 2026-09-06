# Community Audit Log and Danger Zone

## Scope

Picom's Community Admin panel provides an owner/admin audit viewer and an
owner-only Danger Zone. The supported community-removal action is immediate,
irreversible deletion; it is separate from account deletion recovery.

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

## Community deletion

- Current owner only; moderator, member and foreign users are denied by the
  trusted RPC.
- Requires one clear irreversible confirmation only. It does not ask for a
  reason, exact-name typing, password or email.
- The transaction removes user-facing community access immediately, revokes
  invites, blocks joins, ends Community Live sessions and records a safe audit
  event.
- Required audit/security retention is non-restorable. There is no community
  restore action, scheduler or finalizer.

## Backup and recovery impact

- Verify a database backup before risky lifecycle migrations or operations changes.
- Community deletion does not replace backup: storage objects and database metadata must remain consistent.
- A retained audit record does not create a product restore path.
- A failed delete/transfer transaction needs no compensating partial write because PostgreSQL rolls it back atomically.
- Follow `docs/backup-verification.md`, `docs/database-restore-drill.md`, and `docs/rollback-runbook.md` for infrastructure recovery, not user-facing community restoration.

## Evidence limits

Repository smoke tests validate contracts. Live RLS/pgTAP evidence requires an approved local or staging Supabase CLI context; absence of that environment is reported as blocked, never passed.
