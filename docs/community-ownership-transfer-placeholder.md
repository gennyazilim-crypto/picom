# Community Ownership Transfer Placeholder

Picom prepares community ownership transfer as an owner-only placeholder. The MVP renderer does not change roles or ownership records directly.

## Current behavior

- Current owners see an ownership transfer card in the community sidebar setup area.
- The owner must select an existing community member.
- The owner must type the exact community name before the placeholder can be prepared.
- The placeholder records local intent only; roles, membership, and audit logs are not mutated.

## Future production requirements

- Use a trusted Supabase Edge Function or backend route for real transfer.
- Verify the caller is the current owner through RLS/server-side checks.
- Verify the target user is a current, non-deleted, non-banned member.
- Update owner role/member roles atomically.
- Create an audit log entry in the same transaction or trusted operation.
- Prevent the owner from leaving a community until ownership has been transferred.

## Manual verification

1. Sign in as/mock a community owner.
2. Open a community in the desktop sidebar.
3. Select a target member.
4. Confirm the Prepare transfer button remains disabled until the exact community name is typed.
5. Prepare the placeholder and confirm the status text updates without changing member roles.