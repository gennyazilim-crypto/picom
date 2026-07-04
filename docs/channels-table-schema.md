# Channels table schema

Task 112 hardens `public.channels`, the table that stores text and voice placeholder channels for the Picom desktop community layout.

## Table purpose

Channels drive the CommunitySidebar channel list, ChatHeader context, MessageList data scope, and future Supabase/Realtime room subscriptions.

## Baseline fields

- `id`: UUID primary key.
- `community_id`: owning community reference.
- `category_id`: optional channel category reference.
- `name`: user-facing channel name.
- `type`: channel type, currently `text` or `voice`.
- `topic`: optional channel description shown in the chat header.
- `is_private`: future private channel visibility flag.
- `position`: ordering inside the community/sidebar.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.
- Unique pair: `community_id` and `name`.

## Schema hardening added

- Channel names must be 1 to 80 characters.
- Channel topics are optional and limited to 300 characters.
- Channel positions must stay between 0 and 10000.
- Channel names are unique per community in a case-insensitive way.
- Category assignment is validated so a channel cannot point to a category from another community.

## Indexes added

- `idx_channels_category_position` supports grouped channel rendering.
- `idx_channels_community_type_position` supports text/voice filtering and ordering.
- `idx_channels_community_private` supports private-channel visibility checks.

## RLS and security notes

RLS is enabled in the baseline migration. Future policies should let users read channels for communities they belong to, while private channel access must be restricted by membership/role policy. Client UI can hide private channels for polish, but Supabase policies must remain the source of truth.

Creating, editing, deleting, or reordering channels should require a trusted `manageChannels` permission path.

## Test steps

1. Apply migrations in a local Supabase project.
2. Insert a text channel with a valid name, community, and category from the same community.
3. Try assigning a category from a different community; it should fail.
4. Try inserting duplicate channel names with different casing in the same community; the second insert should fail.
5. Confirm channel list queries by `community_id`, `type`, and `position` still return ordered results.