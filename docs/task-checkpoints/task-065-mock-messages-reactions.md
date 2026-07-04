# Task 065 checkpoint - Mock messages and reactions

## Completed

- Added `src/data/mockMessages.ts`.
- Moved mock message and reaction generation out of `mockCommunities.ts`.
- Preserved generated attachment grids and reaction placeholders.
- Kept mock mode backend-free.

## Verification

- Run `npm run typecheck`.
- Run `npm run build`.
- Manually inspect message list, reaction rows, and attachment grids in dev mode.