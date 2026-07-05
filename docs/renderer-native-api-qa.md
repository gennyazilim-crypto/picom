# Renderer Native API QA

React renderer code must not call Electron or Node APIs directly.

## Command

```powershell
npm run renderer:native:smoke
```

`npm run qa:smoke` includes this check.

## Why this matters

Picom keeps Electron native access behind:

- `electron/preload.cts`
- safe IPC channel allowlists
- renderer service abstractions

This keeps `contextIsolation` meaningful and prevents React components from growing unsafe native dependencies.

## Blocked in renderer code

- direct `electron` imports
- `ipcRenderer`
- `desktopCapturer`
- `shell.openExternal`
- `contextBridge`
- `window.require`
- Node builtin imports from `node:`

## Manual QA

- Confirm WindowTitleBar buttons still use service/preload methods.
- Confirm file picking uses `fileService`.
- Confirm external links use `externalLinkService`.
- Confirm screen share source picking stays behind the approved desktop bridge.
