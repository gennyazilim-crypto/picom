# Electron Preload API Contract

Contract: `window.picomDesktop`  
Contract version: `1`  
Status: frozen for the current Picom desktop release line

## Boundary

The renderer has no direct Electron or Node.js access. Electron runs with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Preload exposes one frozen object through `contextBridge`; it does not expose `ipcRenderer`, `desktopCapturer`, `shell`, `fs`, `path`, `process`, `Buffer`, `require`, or Electron module objects.

Every request uses a channel from `IPC_CHANNELS` through `invokeWhitelisted`. Main-process handlers reject untrusted renderer URLs before native work. Payloads are type/length/protocol validated in preload and/or main; returned objects contain bounded serializable data only.

## Top-level API

| API | Input | Safe result/purpose |
| --- | --- | --- |
| `contractVersion` | none | Literal `1`; renderer/service compatibility marker |
| `getRuntimeInfo()` | none | Electron platform and Electron/Chrome/Node version strings |
| `windowControl(action)` | `minimize`, `maximize`, or `close` | Performs one window action |
| `isWindowMaximized()` | none | Boolean maximize/fullscreen visual state |
| `onWindowMaximizeStateChanged(callback)` | callback | Subscribes to boolean state; returns unsubscribe |
| `showNotification(payload)` | bounded title/body/tag/silent fields | Displays native notification when supported |

Runtime info is diagnostics metadata only. It must not include environment variables, filesystem paths, usernames, hostnames, credentials, command execution, or mutable Electron objects.

## Screen capture

`screenCapture.getSources()` returns safe source descriptors:

- `id`
- `name`
- `type` (`screen` or `window`)
- thumbnail/app-icon data URL or null

The bridge does not expose `desktopCapturer`. Main verifies the sender, handles macOS permission state, and returns safe error codes. Capture starts only after explicit renderer/user selection through the voice service.

## Tray

- `tray.setStatus(status)` accepts `online`, `idle`, `dnd`, or `invisible`.
- `tray.setMuted(boolean)` updates notification mute state.
- `tray.setCloseToTray(boolean)` updates close behavior where supported.
- `tray.showWindow()` focuses/restores Picom.
- `tray.quit()` performs the explicit quit path.
- `tray.onAction(callback)` receives validated action/status/muted payloads and returns unsubscribe.

## Startup

- `startup.getState()` returns supported/enabled state.
- `startup.setEnabled(boolean)` is packaged-app only and uses OS-supported login-item settings.

No arbitrary executable, argument, registry key, service, shell, or launch path is accepted from the renderer.

## File

- `file.pickImages()` opens a native image picker and returns at most four bounded PNG/JPEG/WEBP/GIF files as safe descriptors/data URLs.
- `file.saveText({ defaultPath?, content })` accepts bounded sanitized default filename and bounded text content, opens a save dialog, and writes only the user-selected destination.

No raw filesystem path enumeration, arbitrary read, directory traversal, delete, move, chmod, or executable operation is exposed.

## Clipboard

- `clipboard.readText()` returns bounded text.
- `clipboard.writeText(text)` accepts bounded text.

Binary clipboard formats and arbitrary OS clipboard objects are not exposed.

## External links and deep links

- `externalLinks.openUrl(url)` permits normalized `http:`/`https:` only and opens through main-process `shell.openExternal`.
- `deepLinks.onOpen(callback)` receives only validated `picom:` routes/segments and returns unsubscribe.

No `file:`, `javascript:`, `data:`, shell, command, unknown protocol, credentials, fragment abuse, or unbounded deep-link segment is allowed.

## Power resume

`power.onResume(callback)` receives a validated timestamp payload and returns unsubscribe. It does not expose Electron powerMonitor.

## IPC channels

Version 1 uses only:

- `picom:window-control`
- `picom:window-is-maximized`
- `picom:window-maximize-state-changed`
- `picom:screen-capture-get-sources`
- `picom:notification-show`
- `picom:tray-set-status`
- `picom:tray-set-muted`
- `picom:tray-set-close-to-tray`
- `picom:tray-show-window`
- `picom:tray-quit`
- `picom:tray-action`
- `picom:startup-get-state`
- `picom:startup-set-enabled`
- `picom:file-pick-images`
- `picom:file-save-text`
- `picom:clipboard-read-text`
- `picom:clipboard-write-text`
- `picom:external-open-url`
- `picom:deep-link-open`
- `picom:power-resume`

## Change policy

- Additive optional method/result fields require contract test/doc/type updates and security review.
- Removing/renaming a method, changing payload meaning, or widening native capability requires a new major `contractVersion` and coordinated renderer migration.
- Never add generic `invoke(channel, payload)`, raw event subscription, shell/command execution, unrestricted filesystem, arbitrary URL protocol, or Node/Electron object access.
- IPC error strings are stable machine-readable diagnostics, not sensitive stack traces.

## Automated/manual verification

Run:

```bash
npm run electron:preload-contract:test
npm run renderer:native:smoke
npm run electron:security:smoke
npm run typecheck
npm run build
```

Manual packaged check:

1. Confirm `window.picomDesktop.contractVersion === 1` in a development diagnostics session.
2. Exercise window controls, maximize subscription, image picker, diagnostics save, clipboard copy, safe external URL, tray actions, startup state, notification, deep link, resume, and screen source picker.
3. Send invalid action/status/boolean/URL/text/deep-link payloads from an approved development harness; confirm safe error results and no native side effect.
4. Confirm callbacks unsubscribe cleanly and duplicate listeners do not accumulate.
5. Confirm `window.require`, `window.process`, and raw Electron/Node APIs are absent.
