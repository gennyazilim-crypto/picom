# Community Ownership Transfer

The historical filename is retained for links, but ownership transfer is no longer a placeholder. Picom exposes the action only to the current community owner in the desktop Danger Zone.

## Production contract

- The target must be another active member of the same community and must not have an active ban.
- The owner provides a 10-500 character audit reason, types the exact community name, and re-enters the current account password.
- `authService.reauthenticateCurrentUser` sends the password only to Supabase Auth. Picom never persists or logs it.
- `transfer_community_ownership` locks the community and both memberships, updates `communities.owner_id`, legacy primary roles, `community_member_roles`, role audit rows, and the append-only community audit row in one PostgreSQL transaction.
- Failure at any point rolls the transaction back. The UI does not claim partial success.
- The previous owner receives the safest configured non-owner primary role, preferring Admin; the new owner receives the sole primary Owner role link.

## Verification

Run `npm run community:ownership-transfer:smoke` and `npm run community:audit-danger:full:smoke`. Run `supabase test db --file supabase/tests/rls/community_lifecycle_management.sql` only against an approved local or staging database.
