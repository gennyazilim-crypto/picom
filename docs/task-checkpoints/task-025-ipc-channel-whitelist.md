# Task 025 Checkpoint

Task: Add safe IPC channel whitelist

## Completed

- Added `electron/ipcChannels.cts` as the allowed IPC channel registry.
- Updated main process to register `picom:window-control` through the whitelist constants.
- Updated preload bridge to invoke only whitelisted IPC channels.
- Kept React renderer away from direct Electron IPC APIs.

## Verification

Commands run:

```powershell
npm run electron:build
npm run typecheck
npm run build
```

All passed.

Manual Electron dev mode:

```powershell
npm run dev
```