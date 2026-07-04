# Roles table schema

Task 110 hardens `public.roles`, the table that stores community permission groups for Picom MVP communities.

## Table purpose

Roles provide local and future Supabase-backed permission grouping for owners, admins, moderators, members, and guests.

## Baseline fields

- `id`: UUID primary key.
- `community_id`: community reference, cascades with community deletion.
- `name`: user-facing role name.
- `color`: role badge/accent color.
- `level`: role hierarchy value.
- `permissions`: JSON object containing permission flags.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.
- Unique pair: `community_id` and `name`.

## Schema hardening added

- Role color default changed to Picom teal `#007571` so database rows do not depend on frontend CSS variables.
- Role names must be 1 to 40 characters.
- Role colors must be six-digit hex colors.
- Role hierarchy levels must be between 0 and 100.
- `permissions` must remain a JSON object.
- Role names are unique per community in a case-insensitive way.
- `idx_roles_community_level` supports loading roles by community and hierarchy order.

## RLS and security notes

RLS is enabled in the baseline migration. Future role read policies should be tied to community membership. Role creation, editing, and permission changes must require owner/admin permission and should not rely on frontend checks alone.

Permission JSON should contain only public permission flags, never tokens, secrets, or private server-only values.

## Test steps

1. Apply migrations in a local Supabase project.
2. Insert a role with a valid hex color and object permissions; it should succeed.
3. Try inserting `Admin` and `admin` in the same community; the second insert should fail.
4. Try inserting a role with a non-hex color or array permissions; it should fail.
5. Confirm roles can be queried by `community_id` ordered by `level desc`.