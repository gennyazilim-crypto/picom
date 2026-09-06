# Deletion and retention policy

Picom is a Windows/Linux/macOS Electron desktop community chat app backed by Supabase. Deletion behavior must be predictable, safe for audit, privacy, and moderation workflows, and explicit about what is irreversible.

## Status

- Community behavior: owner-only immediate, irreversible deletion behind a controlled feature flag
- Account behavior: email-confirmed 30-day recovery lifecycle behind a separate controlled feature flag
- Current production posture: both user-facing flags remain off pending hosted certification
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
| Messages | Soft-delete | Yes | Active Supabase path sets `messages.deleted_at`; authorized fetches retain content-free tombstones so replies/order stay understandable. Local mock mode uses the same placeholder. |
| Channels | Immediate delete | No | Only the canonical community owner can remove a channel. The server requires another channel as a fallback and cascades dependent channel data safely. |
| Communities | Immediate, non-restorable tombstone | No | Owner-only `delete_owned_community` immediately removes user-facing access, discovery, invites, joins and Community Live; only required non-restorable audit/security records remain. |
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
- `messageListQuery` includes authorized tombstones; the renderer never displays deleted body, reactions, polls, or attachments.
- Realtime treats soft-delete updates as delete events.
- Older realtime updates must not restore a deleted message.

Restore placeholder:

- A future moderator/admin restore action may clear `deleted_at` only if retention policy allows it.
- Restore must be audit logged.
- Restore must not bypass channel visibility or author/moderator permissions.

## Channels

The actual community founder may delete a channel immediately. There is no
password or channel-name typing requirement. The deletion service selects a
fallback first and refuses deletion of the final channel, so the active client
can navigate safely. Moderators, members and foreign users are denied by the
server RPC.

## Communities

Community deletion is immediate and irreversible from the user’s perspective.
The community founder gets one confirmation dialog that explicitly says **Bu
işlem geri alınamaz**. The server marks the community unavailable within the
same trusted transaction, revokes invites, cancels joins, ends Community Live
sessions and writes a safe audit event. There is no community recovery period,
email, scheduler, finalizer or restore path.

Retained audit or security records are non-restorable and do not make the
community visible again.

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

- Delete community: founder-only, one irreversible warning and confirmation.
- Delete channel: founder-only immediate delete with a safe fallback channel.
- Delete account: email confirmation before the 30-day recovery period, then
  trusted finalization and session revocation.
- Delete attachment/storage object: backend-only confirmation and dry-run.
- Purge retention candidates: explicit environment flag and backup verification.

## Restore requirements

Account deletion can be canceled by its authenticated owner during the
email-confirmed 30-day recovery window. Community and channel deletion have no
restore requirement or product restore action.

## Current gaps

- Message tombstones remain active.
- Community and channel delete paths are immediate and founder/owner-scoped;
  hosted certification is still required before feature activation.
- Account deletion remains email-confirmed with 30-day recovery; hosted email
  delivery and finalization certification remain separate release gates.
- Production invite, report, notification, and audit log tables are not active yet.
- Restore APIs are placeholders only.

## Manual verification

1. Delete a message in mock/Supabase mode and confirm it does not render as an active message.
2. Confirm message fetch filters out `deleted_at` rows.
3. Confirm community deletion is owner-only, immediate and has no restore UI.
4. Confirm account deletion starts no countdown before email confirmation.
5. Confirm audit log docs state normal flows cannot delete audit entries.
