# Channel categories table schema

Task 111 hardens `public.channel_categories`, the table used to group channels in the Picom community sidebar.

## Table purpose

Channel categories keep the desktop community sidebar organized into sections such as information, general chat, work spaces, and voice placeholders.

## Baseline fields

- `id`: UUID primary key.
- `community_id`: community reference, cascades with community deletion.
- `name`: user-facing category label.
- `position`: category ordering within a community.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

## Schema hardening added

- Category names must be 1 to 80 characters.
- Category positions must stay between 0 and 10000.
- Category names are unique per community in a case-insensitive way.

## RLS and security notes

RLS is enabled in the baseline migration. Future policies should allow community members to read categories for communities they can view. Creating, editing, deleting, and reordering categories should require `manageChannels` or equivalent owner/admin permission enforced in Supabase policies or trusted server-side functions.

## Test steps

1. Apply migrations in a local Supabase project.
2. Insert a category with a valid name and position; it should succeed.
3. Try inserting an empty name or negative position; it should fail.
4. Try inserting `General` and `general` in the same community; the second insert should fail.
5. Confirm category ordering queries still use `(community_id, position)` from the baseline index.