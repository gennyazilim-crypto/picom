# Database Integrity Constraints Audit

Picom uses Supabase Postgres as the MVP backend for the Windows/Linux/macOS Electron desktop app. This audit documents the current relation, uniqueness, validation, and deletion behavior in the committed migration set.

## Status

- Runtime behavior change: none
- New database migration: none
- Source of truth: `supabase/migrations`
- Reason: current MVP tables already include the critical foreign keys, uniqueness constraints, validation checks, and cross-community guard triggers needed for the active chat flows.
- Prisma schema: not present in this project; Supabase SQL migrations are the database contract.

## Reviewed migrations

- `20260704000100_baseline.sql`
- `20260704000200_profiles_schema.sql`
- `20260704000300_communities_schema.sql`
- `20260704000400_community_members_schema.sql`
- `20260704000500_roles_schema.sql`
- `20260704000600_channel_categories_schema.sql`
- `20260704000700_channels_schema.sql`
- `20260704000800_messages_schema.sql`
- `20260704000900_message_attachments_schema.sql`
- `20260704001000_message_reactions_schema.sql`
- `20260704001100_read_states_schema.sql`
- `20260704002500_message_sequence_numbers.sql`

## Integrity matrix

| Area | Current protection | Deletion behavior | Notes |
| --- | --- | --- | --- |
| Users and profiles | `profiles.id` references `auth.users(id)`, username unique, lower-case unique index, profile length/format checks | Profile cascades when auth user is removed | Account deletion should still use anonymization/soft-delete policy before destructive auth deletion in production. |
| Sessions | Supabase Auth manages session records outside Picom MVP tables | Managed by Supabase Auth | App-level session revocation is documented separately; no local session table exists in the MVP schema. |
| Communities and owners | `communities.owner_id` references `profiles(id)` | `on delete restrict` | Prevents deleting a profile that still owns a community. Ownership transfer must happen first. |
| Community members | `community_id` and `user_id` foreign keys, unique `(community_id, user_id)`, role/community trigger | Community/user deletion cascades; role deletion sets `role_id` null | Trigger `ensure_member_role_matches_community` prevents assigning a role from another community. |
| Roles | `community_id` foreign key, unique role name per community, level range, color format, permissions JSON object check | Community deletion cascades roles | Role permission JSON shape is constrained to an object, but permission key validation remains application/service responsibility. |
| Channel categories | `community_id` foreign key, unique lower-case category name per community, position range | Community deletion cascades categories | Channel deletion policy should move channels to uncategorized or confirm destructive action at service/UI level. |
| Channels | `community_id` foreign key, `category_id` foreign key, unique lower-case channel name per community, type check, position/topic checks | Community deletion cascades channels; category deletion sets `category_id` null | Trigger `ensure_channel_category_matches_community` prevents attaching a channel to a category from another community. |
| Messages | `community_id`, `channel_id`, and `author_id` foreign keys, body/client id checks, edited/deleted timestamp checks, unique `(author_id, client_message_id)` partial index | Community/channel deletion cascades messages; author deletion is restricted | Trigger `ensure_message_channel_matches_community` prevents cross-community channel/message mismatches. |
| Message sequence | Positive sequence check, unique `(channel_id, sequence)` partial index, advisory lock sequence assignment | Follows message deletion behavior | Supports stable per-channel ordering without changing created-at fallback behavior. |
| Attachments | `message_id` and `uploader_id` foreign keys, file/path/MIME/status/dimension checks | Message deletion cascades attachments; uploader deletion is restricted | Storage object cleanup remains a separate operational process. Raw file paths must not be exposed to normal users. |
| Reactions | `message_id` and `user_id` foreign keys, unique `(message_id, user_id, emoji)`, emoji length/control checks | Message/user deletion cascades reactions | Prevents duplicate emoji rows from one user on one message. |
| Read states | `channel_id`, `user_id`, and optional `last_read_message_id` foreign keys, unique `(channel_id, user_id)` | Channel/user deletion cascades; last-read message deletion sets null | Trigger `ensure_read_state_message_matches_channel` prevents read markers pointing to messages from another channel. |

## Placeholder and future tables

These areas are documented or represented in services/UI, but they are not active production tables in the reviewed MVP migration set:

- Invites
- Bans
- Audit logs
- Notifications
- Reports
- Abuse events
- Account activity

Future migrations for these tables should include explicit foreign keys, uniqueness constraints, retention/deletion behavior, and RLS policies before the features are considered production-backed.

## Deletion behavior policy notes

- Audit/security logs should not cascade-delete through normal app flows once implemented.
- Community deletion should remain owner-only and should prefer soft-delete before destructive cascade deletion.
- User deletion should preserve audit integrity through anonymization or deleted-user markers instead of breaking historical moderation records.
- Attachments require both metadata deletion behavior and object storage cleanup/quarantine behavior.
- Private channel access must be enforced by RLS and not by frontend filtering alone.

## Recommended future constraints

### Invites

- Unique invite code hash.
- Foreign key to community.
- Optional creator foreign key with deletion behavior that preserves auditability.
- Check `max_uses >= 0` and `uses <= max_uses` where applicable.
- Partial index for active, non-revoked invites.

### Bans

- Unique active ban per community/user.
- Foreign keys to community, banned user, and moderator.
- Restrict or anonymize moderator deletion according to audit policy.

### Audit logs

- Foreign key to community where applicable.
- Actor and target IDs should be nullable or denormalized enough to survive user deletion.
- Append-only policy; no normal update/delete route.
- Sensitive fields excluded from metadata.

### Notifications

- Foreign key to recipient profile.
- Optional community/channel/message foreign keys with safe `set null` behavior where historical notification records should survive content deletion.
- Index `(user_id, created_at desc)` and unread partial index when the table becomes active.

### Reports

- Foreign keys to reporter, community, and target entities where practical.
- Status check constraint.
- Avoid accidental cascade deletion of moderation evidence unless retention policy explicitly requires it.

## Manual verification checklist

1. Run Supabase migrations locally with `supabase db reset` when the Supabase CLI is available.
2. Confirm cross-community role assignment fails through `ensure_member_role_matches_community`.
3. Confirm channel/category community mismatch fails through `ensure_channel_category_matches_community`.
4. Confirm message/channel community mismatch fails through `ensure_message_channel_matches_community`.
5. Confirm read-state message/channel mismatch fails through `ensure_read_state_message_matches_channel`.
6. Confirm duplicate `(author_id, client_message_id)` messages are rejected.
7. Confirm duplicate `(message_id, user_id, emoji)` reactions are rejected.
8. Confirm owner profile deletion is restricted while owned communities exist.

## Current gaps

- No dedicated production audit log table exists yet.
- No production notification inbox table exists yet.
- No production invite or ban table exists yet.
- No production reports table exists yet.
- No automated Supabase CLI integrity test can run on this machine until the CLI is installed.

