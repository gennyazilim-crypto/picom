# Task 063 checkpoint - Mock members and roles

## Completed

- Added `src/data/mockMembers.ts`.
- Moved mock role definitions and member generation into the new module.
- Kept `currentUserId` exported for the app shell.
- Kept existing mock community behavior unchanged.

## Verification

- Run `npm run typecheck`.
- Run `npm run build`.
- Manually inspect MemberSidebar groups and role badges in dev mode.