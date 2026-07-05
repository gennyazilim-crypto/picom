# Task 422: User Safety Center

## Scope

- Added Settings > Privacy & Safety.
- Centralized blocked users, DM/friend request placeholders, online status, read receipts, data export, account deletion status, report problem, and safety tips.
- Added a small local `userSafetyCenterService`.
- Did not add backend enforcement or advanced DM/friends features.

## Validation

- `npm run safety:center:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

1. Open Settings > Privacy & Safety.
2. Toggle Show online status and Read receipts placeholder.
3. Change DM/friend request policy dropdowns.
4. Confirm blocked users empty/list state renders.
5. Click Report a problem and confirm Settings moves to Advanced beta support.
