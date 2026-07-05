# Database Performance Audit

This audit reviews Picom's current Supabase Postgres schema and query assumptions for the Windows/Linux/macOS desktop community chat MVP. The current migration set already includes targeted indexes for the core chat paths, so this task does not add a new migration.

## Status

- Runtime behavior change: none
- New database migration: none
- Reason: existing MVP indexes cover the current high-frequency chat queries
- Future work: add indexes only when notification, audit log, report, search, or admin tables become active runtime features

## Reviewed migrations

- `20260704000100_baseline.sql`
- `20260704000700_channels_schema.sql`
- `20260704000800_messages_schema.sql`
- `20260704000900_message_attachments_schema.sql`
- `20260704001000_message_reactions_schema.sql`
- `20260704001100_read_states_schema.sql`
- `20260704001200_chat_query_indexes.sql`

## Current indexed query paths

### Message queries by channel and createdAt

Current support:

- `idx_messages_channel_created_at` on `(channel_id, created_at desc)`
- `idx_messages_channel_created_id_desc` on `(channel_id, created_at desc, id desc)`
- `idx_messages_channel_visible_created_at` on `(channel_id, created_at desc)` where `deleted_at is null`
- `idx_messages_community_channel_created_at` on `(community_id, channel_id, created_at desc)`

Assessment: good for MVP channel message fetch and cursor pagination.

### Message pagination

Use keyset pagination by `(created_at, id)` where possible. Avoid large `offset` pagination in active channels.

Recommended query shape:

```sql
where channel_id = $1
  and (created_at, id) < ($cursor_created_at, $cursor_id)
order by created_at desc, id desc
limit $limit
```

Assessment: current indexes support this path.

### Optimistic duplicate prevention

Current support:

- `messages_author_client_message_unique` unique partial index on `(author_id, client_message_id)`
- `idx_messages_client_message_id` partial index

Assessment: good for preventing duplicate optimistic sends and reconnect retries.

### Community/channel list lookup

Current support:

- `idx_channels_community_position`
- `idx_channels_community_category_position`
- `idx_channels_community_type_position`
- `idx_channels_community_private`
- `idx_channel_categories_community_position`

Assessment: good for CommunitySidebar channel/category loading.

### Community member lookup

Current support:

- `idx_community_members_user_id`
- `idx_community_members_community_id`
- `idx_community_members_role_id`
- `idx_community_members_community_role_joined`

Assessment: good for member sidebar and membership checks. If large communities need search, add a future member search index tied to profile display name/username strategy.

### Role/permission lookup

Current support:

- `roles_community_lower_name_unique`
- `idx_roles_community_level`

Assessment: good for role ordering and permission evaluation by community.

### Attachment lookup by message

Current support:

- `idx_attachments_message_id`
- `idx_attachments_message_created_at`
- `idx_attachments_uploader_created_at`
- `idx_attachments_status`

Assessment: good for loading message attachment grids and upload cleanup placeholders.

### Reactions lookup

Current support:

- `idx_reactions_message_id`
- `idx_reactions_message_emoji`
- `idx_reactions_user_created_at`

Assessment: good for reaction counts per message and user reaction history.

### Read/unread state lookup

Current support:

- `idx_read_states_user_channel`
- `idx_read_states_user_updated_at`
- `idx_read_states_channel_updated_at`
- `idx_read_states_last_read_message_id`

Assessment: good foundation for unread/mention state.

## Future query areas not yet fully active

### Search queries

Current state: no production full-text search table/index is active in this audit path.

Future recommendation:

- Add a generated `tsvector` or dedicated search index only after search requirements are stable.
- Filter by community membership and private channel visibility before returning results.
- Avoid indexing private content into public/shared search surfaces.

### Notification inbox queries

Current state: notification inbox is not yet a fully backed production table in the reviewed MVP migrations.

Future recommendation:

- `(user_id, created_at desc)`
- `(user_id, read_at, created_at desc)`
- optional partial index for unread notifications

### Audit log queries

Current state: audit logs are not part of the reviewed MVP migration set.

Future recommendation:

- `(community_id, created_at desc)`
- `(actor_id, created_at desc)`
- `(target_type, target_id, created_at desc)` if moderation review needs it
- keep audit logs append-only and avoid accidental cascade delete

### Invite lookup by code

Current state: invite schema is not part of the reviewed MVP migration set.

Future recommendation:

- unique index on invite code or code hash
- `(community_id, created_at desc)`
- partial index for active/non-revoked invites if the table includes `revoked_at` and `expires_at`

### Reports/moderation/admin lists

Current state: report/admin tables are not part of the reviewed MVP migration set.

Future recommendation:

- `(community_id, status, created_at desc)` for report queues
- `(target_type, target_id)` for report history
- avoid storing sensitive content in abuse/admin event indexes

## Over-indexing guidance

Do not add indexes for placeholder-only features until runtime query volume exists. Every index adds write overhead to message sends, reaction updates, attachment inserts, and membership changes.

Add a new index only when:

- the query is used by production runtime code
- the query shape is stable
- `EXPLAIN` shows sequential scans on large tables
- write overhead is acceptable
- RLS behavior is verified

## Performance risks

- Large channels need keyset pagination, not offset pagination.
- Message attachments can cause layout and network pressure if thumbnails are not used later.
- Search must enforce private channel visibility before returning results.
- Realtime fanout should avoid unbounded typing/presence bursts.
- RLS helper functions must remain index-friendly.

## Verification checklist

- Message fetch by channel uses indexed ordering.
- Message pagination uses cursor/keyset style where possible.
- Optimistic sends use `client_message_id` for duplicate prevention.
- Channel sidebar lookup uses community/category/position indexes.
- Member sidebar lookup uses community/member/role indexes.
- Attachment grid lookup uses message attachment index.
- Reaction rows use message/emoji indexes.
- Future audit/search/notification/report indexes are documented but not over-applied.

## Manual test steps

1. Review `supabase/migrations/20260704001200_chat_query_indexes.sql`.
2. Confirm `idx_messages_channel_created_id_desc` exists for channel pagination.
3. Confirm attachment, reaction, read state, member, role, and channel indexes exist in migrations.
4. Avoid adding new indexes until production query shapes are active.
