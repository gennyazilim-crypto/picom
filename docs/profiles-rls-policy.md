# Profiles RLS policy

Task 130 adds RLS policies for `public.profiles`.

## Policies

- `profiles_select_visible`: authenticated users can read their own profile or profiles of users who share a community.
- `profiles_insert_own`: authenticated users can insert only their own profile row.
- `profiles_update_own`: authenticated users can update only their own profile row.

No delete policy is added for normal users.

## Helper function

`public.can_view_profile(profile_id uuid)` centralizes profile visibility logic.

It returns true when:

- `auth.uid()` matches the profile id.
- The viewer and target user share a community membership.

## Grants

Authenticated users receive:

- `select`, `insert`, and `update` on `public.profiles`.
- Execute on the profile visibility helper.

## Security notes

Profiles contain user-facing public chat fields only. Passwords, auth tokens, refresh tokens, and authorization headers are never stored in `public.profiles`.

This policy avoids a fully global profile directory while still supporting member lists and message author display inside shared communities.

## Test steps

1. Apply migrations locally.
2. Sign in as a seeded user.
3. Confirm the user can select their own profile.
4. Confirm the user can select profiles from shared communities.
5. Confirm the user cannot update another user's profile.
6. Confirm normal users cannot delete profile rows.