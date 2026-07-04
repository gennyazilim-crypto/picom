# Chat query indexes

Task 117 adds targeted Supabase/Postgres indexes for the highest-frequency chat reads in the Picom desktop MVP.

## Indexed query paths

- Message pagination by channel: `channel_id`, `created_at desc`, `id desc`.
- Recent community activity: `community_id`, `created_at desc`.
- Author-scoped channel history: `channel_id`, `author_id`, `created_at desc`.
- Community sidebar channel ordering: `community_id`, `category_id`, `position`.
- Member sidebar role grouping: `community_id`, `role_id`, `joined_at`.
- User unread/read-state lookup: `user_id`, `updated_at desc`.
- Attachment loading for message rows: `message_id`, `created_at`.

## Why these indexes

The desktop MVP keeps sidebars fixed and chat scrolling independently. The app needs fast, predictable reads for:

- Loading channel message history.
- Switching channels without visible lag.
- Rendering grouped channels and members.
- Resolving unread indicators.
- Loading attachment grids for visible message rows.

## RLS and security notes

Indexes do not change access control. Supabase RLS policies must still enforce membership, private channel access, and message visibility. Query performance should never be achieved by bypassing RLS from the client.

## Test steps

1. Apply migrations in a local Supabase project.
2. Run message pagination queries by `channel_id` ordered by `created_at desc, id desc`.
3. Run channel list queries by `community_id` ordered by category/position.
4. Run member list queries grouped by role.
5. Use `explain` locally to confirm indexes are available for larger seeded data.