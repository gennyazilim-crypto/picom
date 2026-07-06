# Soft Delete and Restore Policy

Picom is a Windows/Linux/macOS Electron desktop community chat app backed by Supabase. Deletion behavior must be predictable, reversible where practical, and safe for audit, privacy, and moderation workflows.

## Status

- Runtime behavior change: none
- New destructive job: none
- Current production posture: conservative placeholders for risky deletes
- Source of truth for active schema: `supabase/migrations`
- Related docs:
  - `docs/database-integrity.md`
  - `docs/message-retention.md`
  - `docs/compliance-export-deletion-hardening.md`
  - `docs/audit-log-immutability.md`

## Deletion categories

- Hard-deleted: permanently removed from the active database/storage path.
- Soft-deleted: retained with a deletion timestamp or tombstone field and hidden from normal user views.
- Archived: retained but removed from active navigation or posting flows.
- Never deleted by normal app flows: protected records requiring separate retention/legal/admin process.

## Entity policy matrix

| Entity | Policy | Restore placeholder | Current implementation notes |
| --- | --- | --- | --- |
| Messages | Soft-delete | Yes | Active Supabase path sets `messages.deleted_at`; normal fetch excludes deleted rows. Local mock mode renders a deleted message placeholder. |
| Channels | Archive or soft-delete preferred | Yes | Current update/delete service is placeholder-only. Existing DB cascade only applies if a community is destructively deleted. |
| Communities | Soft-delete preferred | Yes | Current UI exposes owner-only delete safety placeholder and requires explicit name confirmation. Future schema should add `deleted_at`. |
| Users/profiles | Anonymize or mark deleted | Limited | Supabase Auth deletion can cascade profile rows, but production account deletion should anonymize before destructive auth deletion. |
| Attachments | Soft-delete/quarantine metadata first; storage hard-delete after retention | Limited | Metadata cascades if the message is destructively deleted; storage cleanup must be a guarded backend job. |
| Invites | Revoke/expire, then hard-delete cleanup later | No normal restore | Invite production table is not active yet. Cleanup scripts should only remove expired/revoked invites after retention. |
| Roles | Restrict or reassign before deletion | Limited | Current role rows cascade with community deletion; production role deletion should reassign members or prevent deletion while assigned. |
| Reports | Archive/retain | No normal restore | Production reports table is not active yet. Reports should preserve moderation context and not cascade accidentally. |
| Notifications | User-clearable hard delete or archive | No | Production notification table is not active yet. User clearing notifications should not delete source messages. |
| Audit logs | Never deleted by normal app flows | No | Audit logs must be append-only and retained separately from message/community deletion. |

## Messages

Current behavior:

- `messageDeleteMutation` updates `deleted_at`.
- `messageListQuery` filters `deleted_at is null`.
- Realtime treats soft-delete updates as delete events.
- Older realtime updates must not restore a deleted message.

Restore placeholder:

- A future moderator/admin restore action may clear `deleted_at` only if retention policy allows it.
- Restore must be audit logged.
- Restore must not bypass channel visibility or author/moderator permissions.

## Channels

Future policy:

- Prefer `archived_at` or `deleted_at` before hard delete.
- Hide archived/deleted channels from the sidebar.
- Move channels out of deleted categories safely.
- Restore should preserve category and position if possible, or restore to uncategorized if the category no longer exists.

Danger requirements:

- Channel deletion should require confirmation when messages exist.
- Private channel restore must preserve permissions.

## Communities

Future policy:

- Add `deleted_at` for soft delete.
- Owner-only delete flow.
- Confirmation must require typing the community name.
- Soft-deleted communities must be inaccessible from normal community list, channels, messages, realtime rooms, and invites.
- Audit trail must remain intact.

Restore placeholder:

- Restore only by owner/app-admin within retention window.
- Restore must re-enable access only after membership, channels, roles, invites, and storage references are checked.

## Users and profiles

Future policy:

- Account deletion should revoke sessions.
- User-facing profile data should be anonymized or marked deleted.
- Owned communities require transfer, archival, or explicit reviewed owner-delete flow.
- Historical messages may remain attributed to a deleted-user placeholder where retention allows.
- Audit logs should preserve actor identity in a privacy-reviewed way.

## Attachments

Future policy:

- Suspicious/quarantined attachments should be blocked from rendering.
- Deleted attachment metadata should be retained long enough for moderation and support review.
- Storage object hard-delete must be backend-only, dry-run first, and coordinated with metadata.
- Private channel attachment access rules must still apply while metadata exists.

Restore placeholder:

- Restore metadata only if the storage object still exists and scan status allows rendering.

## Invites

Future policy:

- Revoke and expire invites instead of deleting immediately.
- Cleanup jobs may hard-delete expired invite records only after retention.
- Invite secrets/codes should be hashed where practical.
- Deleted communities must invalidate or hide invites.

## Roles

Future policy:

- Default `Owner` and `Member` roles should not be hard-deleted through normal UI.
- Deleting a role with assigned members should require reassignment.
- Role deletion/restoration must not allow privilege escalation.

## Reports

Future policy:

- Reports should be retained or archived for moderation review.
- Reports should not expose private content beyond permitted moderation context.
- Reports should not be hard-deleted through normal user flows.

## Notifications

Future policy:

- Users may clear notification inbox entries.
- Clearing a notification must not delete source messages, communities, channels, or audit data.
- Muted/digest records can be archived without affecting source content.

## Audit logs

Policy:

- Audit logs are append-only.
- Normal app flows must not update/delete audit logs.
- Audit retention is separate from message retention.
- Account/community deletion must preserve audit integrity.

## Confirmation requirements

Dangerous actions should require clear confirmation:

- Delete community: owner-only, type community name, final confirmation.
- Delete channel with messages: confirm name or explicit danger modal.
- Delete account: confirmation phrase, session revocation, ownership handling.
- Delete attachment/storage object: backend-only confirmation and dry-run.
- Purge retention candidates: explicit environment flag and backup verification.

## Restore requirements

Restore actions should:

- Be permission-protected.
- Be audit logged.
- Check RLS and community/channel visibility.
- Fail safely if related parent records no longer exist.
- Avoid restoring quarantined or unsafe attachments.
- Preserve ordering and sidebar state where practical.

## Current gaps

- `deleted_at` is active for messages only.
- Community soft-delete schema is not active yet.
- Channel archive/soft-delete schema is not active yet.
- User anonymization table/fields are not active yet.
- Production invite, report, notification, and audit log tables are not active yet.
- Restore APIs are placeholders only.

## Manual verification

1. Delete a message in mock/Supabase mode and confirm it does not render as an active message.
2. Confirm message fetch filters out `deleted_at` rows.
3. Confirm community delete UI remains owner-only and confirmation-gated.
4. Confirm account deletion placeholder says no renderer-side data has been deleted.
5. Confirm audit log docs state normal flows cannot delete audit entries.

