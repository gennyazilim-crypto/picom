# Communities RLS policy

Task 131 adds RLS policies for `public.communities`.

## Policies

- `communities_select_owned_or_member`: authenticated users can read communities they own or belong to.
- `communities_insert_own`: authenticated users can create communities only with themselves as owner.
- `communities_update_owner`: only owners can update community rows.

No delete policy is added for normal users in this task.

## Helper function

`public.is_community_member(target_community_id uuid)` checks whether the current auth user belongs to a community.

The helper is `security definer` with a fixed search path so policies can safely check membership without depending on frontend state.

## Grants

Authenticated users receive:

- `select`, `insert`, and `update` on `public.communities`.
- Execute on `public.is_community_member(uuid)`.

## Security notes

Community visibility is enforced by Supabase RLS. The Electron UI can hide unavailable communities, but RLS remains the source of truth.

A user cannot create a community for another owner because inserts require `owner_id = auth.uid()`.

## Test steps

1. Apply migrations locally.
2. Sign in as a seeded user.
3. Confirm owned/member communities are visible.
4. Try inserting a community with another user as `owner_id`; it should fail.
5. Try updating a community as a non-owner; it should fail.