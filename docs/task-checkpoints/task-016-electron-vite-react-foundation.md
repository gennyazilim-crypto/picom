# Task 016 Checkpoint

Task: Create Electron + Vite + React + TypeScript app foundation

## Completed

- Added Electron development dependencies.
- Added Electron main process foundation in `electron/main.cts`.
- Added secure preload bridge foundation in `electron/preload.cts`.
- Added `tsconfig.electron.json` for Electron TypeScript compilation.
- Added renderer global type for the `window.picomDesktop` preload bridge.
- Added `main`, `electron:build`, and `electron:dev` entries to `package.json`.
- Tightened Vite dev server to `127.0.0.1:5173` with `strictPort` so Electron does not accidentally load the wrong port.

## Security posture

- `contextIsolation` is enabled.
- `nodeIntegration` is disabled.
- React renderer does not call Electron native APIs directly.
- Preload exposes only a minimal runtime metadata object.

## Verification

Commands run:

```powershell
npm run electron:build
npm run typecheck
```

Both passed.

A controlled `npm run electron:dev` smoke was started and remained running until the test process was intentionally stopped. During that smoke, an existing process was already using port `5173`, so Vite tried `5174`; this task then added `strictPort` to prevent Electron/Vite port mismatch in future runs.

To manually test Electron dev mode after freeing port `5173`:

```powershell
npm run electron:dev
```