# Community members table schema

Task 109 hardens `public.community_members`, the table that connects profiles to communities and their assigned role.

## Table purpose

`public.community_members` powers community membership checks, member sidebar data, local permission decisions, and future Supabase RLS policies.

## Baseline fields

- `id`: UUID primary key.
- `community_id`: community reference, cascades when a community is removed.
- `user_id`: profile reference, cascades when a profile is removed.
- `role_id`: optional role reference, set to null when the role is deleted.
- `joined_at`: membership timestamp.
- Unique pair: one membership per `community_id` and `user_id`.

## Schema hardening added

- `idx_community_members_role_id` supports role-based member lookup.
- `ensure_member_role_matches_community()` prevents assigning a role from one community to a member record in another community.
- `trg_community_members_role_matches_community` applies the consistency check before inserts and relevant updates.

## RLS and security notes

RLS is enabled in the baseline migration. Future policies should use this table as the source of truth for community access. Client-side UI may hide unauthorized actions, but Supabase policies and trusted server-side functions must enforce actual access.

The role/community consistency trigger is `security definer` with a fixed `search_path` so it can perform its integrity check predictably without exposing privileged client behavior.

## Test steps

1. Apply migrations in a local Supabase project.
2. Create two communities and one role in the first community.
3. Insert a member into the first community with that role; it should succeed.
4. Try assigning that role to a member record in the second community; it should fail with a constraint-style error.
5. Confirm normal member lookup by `community_id` and `user_id` still works.