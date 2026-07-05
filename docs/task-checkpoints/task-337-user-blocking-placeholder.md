# Task 337 - User Blocking Placeholder

## Status

Completed.

## Scope

- Added local user blocking service.
- Added Block/Unblock actions to UserProfilePopover.
- Added blocked-message collapsed placeholder rendering.
- Added documentation and a smoke test.

## Changed files

- `src/services/userBlockingService.ts`
- `src/components/UserProfilePopover.tsx`
- `src/components/MessageList.tsx`
- `src/components/ChatMain.tsx`
- `src/App.tsx`
- `src/styles.css`
- `scripts/user-blocking-placeholder-smoke-test.mjs`
- `package.json`
- `docs/user-blocking-placeholder.md`
- `docs/task-checkpoints/task-337-user-blocking-placeholder.md`

## Verification

- `npm run privacy:blocking:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual test

1. Start Picom in Electron dev mode.
2. Open a member profile popover.
3. Click Block.
4. Confirm that user's messages collapse.
5. Click Unblock and confirm messages return.

## Notes

- This is local placeholder behavior only.
- Backend block persistence and DM/friend-request enforcement remain future work.