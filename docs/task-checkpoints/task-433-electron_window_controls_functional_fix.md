# Task 433 - Electron Window Controls Functional Fix

Status: COMPLETE

## Scope

Restore functional custom Electron window controls without enabling the native menu or weakening renderer isolation. The task covers development mode and the unpacked Windows package.

## Root cause

The BrowserWindow correctly referenced `dist-electron/preload.cjs`, but the compiled preload still contained `require("./ipcChannels.cjs")`. Electron sandboxed preloads cannot load arbitrary local CommonJS modules. Electron therefore logged `Unable to load preload script` and `module not found: ./ipcChannels.cjs`, leaving `window.picomDesktop` undefined. The titlebar rendered, but native actions could not reach IPC.

## Resolution

- Added a deterministic Electron build script that runs TypeScript compilation and bundles the preload into one CommonJS file with Vite.
- Kept `electron` external while bundling local preload dependencies.
- Added a post-build guard that rejects unresolved local `require()` calls in the sandboxed preload.
- Kept `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`.
- Kept the native application menu disabled and the frameless custom titlebar enabled.
- Made window actions fail closed when the preload bridge is unavailable.
- Returned the current maximize state from native actions and normalized IPC failures.
- Added accessible labels, pending-action state, focus-visible styles, and explicit drag/no-drag boundaries.

## Live evidence

### Electron development renderer

- Picom renderer opened at `http://127.0.0.1:5173/`.
- `window.picomDesktop` was present after the preload bundle fix.
- Command search DOM click: PASS.
- Theme toggle changed `data-theme` from `light` to `dark`: PASS.
- Minimize changed Win32 `IsIconic` to true: PASS.
- Maximize changed Win32 `IsZoomed` to true: PASS.
- Restore changed Win32 `IsZoomed` to false and the accessible label returned to `Maximize window`: PASS.
- Close terminated the renderer/CDP target. The same close path was additionally verified with Win32 visibility in the packaged application.

### Windows unpacked package

Target: `release/win-unpacked/Picom.exe`

- Production file renderer loaded from `resources/app.asar/dist/index.html`.
- Preload bridge loaded: PASS.
- Command search: PASS.
- Theme toggle: PASS.
- Minimize: PASS.
- Restore after minimize: PASS.
- Maximize: PASS.
- Restore: PASS.
- Close left no visible window: PASS.

Titlebar dragging remains a human pointer smoke check; its drag/no-drag CSS contract is covered by `electron:window-controls:test`.

## Commands and results

- `npm ci` - PASS, 0 vulnerabilities.
- `npm run electron:build` - PASS, sandbox-safe preload generated.
- `npm run package:win:dir` - PASS.
- `npm run electron:window-controls:test` - PASS.
- `npm run electron:preload-contract:test` - PASS.
- `npm run electron:security:smoke` - PASS.
- `npm run electron:ipc-fuzz:test` - PASS.
- `npm run desktop:smoke` - PASS.
- `npm run typecheck` - PASS.
- `npm run mock:smoke` - PASS.
- `npm run build` - PASS.
- `npm run qa:smoke` - PASS.
- `npm run performance:budget:ci` - PASS.

Performance remained within hard limits: 2,758.4 KiB total assets, 1,401.9 KiB largest JS chunk, 216.2 KiB largest CSS chunk, and 29 generated assets.

## Changed files

- `electron/main.cts`
- `electron/preload.cts`
- `src/types/picomDesktop.d.ts`
- `src/services/windowService.ts`
- `src/components/WindowTitleBar.tsx`
- `src/styles.css`
- `package.json`
- `scripts/build-electron.mjs`
- `scripts/electron-window-controls-smoke-test.mjs`
- `docs/electron-window-controls-manual-smoke.md`
- `docs/task-checkpoints/task-433-electron_window_controls_functional_fix.md`

## Remaining observations

- The renderer build still reports the previously documented large entry chunk and ineffective `voiceService` dynamic import warnings. Both remain under the enforced performance hard caps and are outside this task.
- The pointer drag gesture should still be included in the next human desktop smoke pass.
