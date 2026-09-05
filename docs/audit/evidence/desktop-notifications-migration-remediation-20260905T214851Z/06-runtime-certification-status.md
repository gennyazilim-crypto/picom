# Runtime certification status after schema release

No controlled pair of normal-JWT internal users was available to this release
worktree, and no production-configured current Windows notification package was
available for launch. Therefore the following are intentionally **not** marked
as passed by static, service-role, or catalog evidence:

- hosted two-user RLS enforcement using normal JWTs;
- friend request, DM, presence, and Live production event E2E;
- custom Windows toast delivery, taskbar position, stack, tray, actions, DND,
  reconnect, and active-conversation suppression;
- controlled feature-flag rollout.

Non-production transaction and trigger validation remains recorded separately,
but does not substitute for hosted or Windows runtime certification. The
feature flag remains off.
