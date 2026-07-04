# Mock members and roles

Task 063 separates mock member and role generation from the community dataset.

## Runtime source

- `src/data/mockMembers.ts` owns mock roles, member names, current user id, and member generation.
- `src/data/mockCommunities.ts` imports those helpers and keeps community/channel/message structure focused.

## Included roles

- Owner
- Admin
- Moderator
- Member
- Guest

## Included member states

- Online
- Idle
- Do Not Disturb
- Offline

## Avatar behavior

Mock members do not need committed profile image URLs. If `avatarUrl` is missing, the shared avatar service assigns a stable one-time fallback from the local avatarpack.