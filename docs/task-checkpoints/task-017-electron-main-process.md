# Task 017 Checkpoint

Task: Configure Electron main process

## Completed

- Hardened `electron/main.cts` window configuration.
- Added app id setup for desktop identity.
- Kept default window size at 1440x900 and minimum size at 1100x700.
- Kept `contextIsolation` enabled and `nodeIntegration` disabled.
- Enabled renderer sandbox and web security.
- Added safe external link handling through Electron main process.
- Prevented untrusted navigation away from the app.
- Added window lifecycle cleanup on close.

## Runtime changes

Electron main process configuration only. React renderer UI was not changed.

## Verification

Commands run:

```powershell
npm run electron:build
npm run typecheck
```

Both passed.

Manual Electron dev mode:

```powershell
npm run electron:dev
```

Port `5173` must be free because Vite now uses `strictPort` to avoid loading the wrong renderer URL.