# Task 335 - Channel Reorder UI Placeholder

## Status

Completed.

## Scope

- Added owner/admin up/down channel reorder controls.
- Added local `moveChannel` state operation.
- Added documentation and a smoke test.

## Changed files

- `src/state/useLocalMessageState.ts`
- `src/components/ChannelCategory.tsx`
- `src/components/CommunitySidebar.tsx`
- `src/App.tsx`
- `src/styles.css`
- `scripts/channel-reorder-ui-smoke-test.mjs`
- `package.json`
- `docs/channel-reorder-ui-placeholder.md`
- `docs/task-checkpoints/task-335-channel-reorder-ui-placeholder.md`

## Verification

- `npm run channel:reorder:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual test

1. Start Picom in Electron dev mode.
2. Open a mock owner/admin community.
3. Hover a channel and click up/down reorder controls.
4. Confirm the channel order changes without changing the active channel.

## Notes

- This is local placeholder behavior.
- Backend persistence and RLS enforcement remain future work.