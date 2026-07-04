# Task 021 Checkpoint

Task: Set default window size 1440x900 and min size 1100x700

## Completed

- Centralized Electron window size constants in `electron/main.cts`.
- Default window size remains `1440x900`.
- Minimum window size remains `1100x700`.
- No renderer UI changes were made.

## Verification

Commands run:

```powershell
npm run electron:build
npm run typecheck
```

Both passed.

Manual Electron dev mode:

```powershell
npm run dev
```