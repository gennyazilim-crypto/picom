# Community deletion policy

Community deletion is an **immediate, irreversible** owner action. It is not
part of the account-deletion recovery lifecycle.

## Product flow

1. The community founder opens **Topluluğu sil** in Danger Zone.
2. PICOM shows one confirmation dialog stating that the action cannot be
   undone.
3. The trusted `delete_owned_community` RPC verifies `auth.uid()` against the
   canonical `communities.owner_id` and makes the community unavailable at
   once.

There is no password, typed community name, archive reason, email, recovery
screen, scheduled deletion date, or restore action.

## Immediate effects

- The community is removed from normal navigation, discovery, search and
  Community Live surfaces.
- Existing member, channel, message and attachment access is denied by the
  active-community RLS boundary.
- Pending invites are revoked, joins are denied and active Community Live
  sessions are ended.
- The community owner, moderator, member and foreign users cannot restore it.

Only minimum audit/security records that must be retained remain as
non-restorable records. Personal account deletion is documented separately and
continues to require email confirmation before its 30-day recovery period.
