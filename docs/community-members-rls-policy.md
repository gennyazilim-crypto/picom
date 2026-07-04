# Community members RLS policy

Task 132 adds RLS policies for `public.community_members`.

## Policies

- `community_members_select_same_community`: members can read member rows for communities they belong to.
- `community_members_insert_owner_or_self_owner`: community owners can insert membership rows.
- `community_members_update_owner`: only community owners can update membership rows.
- `community_members_delete_owner`: only community owners can delete membership rows.

## Helper function

`public.is_community_owner(target_community_id uuid)` checks if the current auth user owns a community.

This function complements `public.is_community_member()` from the communities RLS task.

## Security notes

Membership rows are used by RLS policies across profiles, communities, channels, and messages. They should be treated as security-sensitive.

Normal users cannot arbitrarily add themselves to communities. Invite acceptance or owner-managed membership should be handled through explicit trusted flows in later tasks.

## Test steps

1. Apply migrations locally.
2. Sign in as a community member and select member rows for that community.
3. Confirm rows from unrelated communities are not visible.
4. Try updating another user's role as a non-owner; it should fail.
5. Try inserting a membership row as a non-owner; it should fail.
6. Confirm the community owner can manage membership rows.