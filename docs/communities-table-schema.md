# Communities table schema

Task 108 adds the MVP schema hardening layer for `public.communities` on top of the baseline Supabase migration.

## Table purpose

`public.communities` stores the top-level community/server-like workspaces shown in the Picom desktop rail and community sidebar.

## Baseline fields

- `id`: UUID primary key.
- `owner_id`: profile owner reference, restricted on delete.
- `name`: user-facing community name.
- `description`: optional short community description.
- `icon_url`: optional storage/public URL for community icon assets.
- `accent_color`: token-safe hex accent color, defaulting to Picom teal.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

## Validation added

- Community names must be 1 to 80 characters.
- Descriptions are optional and limited to 500 characters.
- Icon URLs are optional and limited to 2048 characters.
- Accent colors must be six-digit hex colors.

## Indexes added

- `idx_communities_owner_id` supports loading communities owned by the current profile.
- `idx_communities_created_at` supports admin/debug listing and newest-first ordering.

## RLS and security notes

RLS is enabled in the baseline migration. Client-side access should never bypass RLS. Future policies should allow members to read communities they belong to, owners/admins to update permitted fields, and privileged operational changes only through trusted server-side code or Supabase Edge Functions.

## Test steps

1. Apply Supabase migrations in a local Supabase project.
2. Insert a community with a valid name and accent color.
3. Confirm invalid accent colors and overlong descriptions are rejected.
4. Confirm community list queries by `owner_id` use the new index in query plans when applicable.