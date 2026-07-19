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

`screenCapture.getSources({ requestId, userInitiated: true })` starts a short-lived, focused-window picker session and returns safe source descriptors:

- `id`
- `name`
- `type` (`screen` or `window`)
- thumbnail/app-icon data URL or null

`screenCapture.selectSource({ requestId, sourceId })` accepts only a source from that same unexpired WebContents-bound session and consumes the session. `screenCapture.cancelSelection({ requestId })` invalidates it without capture. Source count, names, identifiers, thumbnails, and icon data URLs are bounded.

The bridge does not expose `desktopCapturer`. Main verifies the sender and focused explicit-action payload, handles macOS permission state, and returns safe error codes. Capture starts only after the selected source is approved through this narrow one-use contract.

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

## Updates

The renderer never owns the updater. `electron-updater` runs only in the main process (`electron/updater.cts`) and is disabled by default; it activates only when `PICOM_UPDATE_FEED_URL` points at an HTTPS feed and the app is packaged (or `PICOM_UPDATE_ALLOW_DEV=1` for local tests). Policy is auto-download, manual install (`autoDownload = true`, `autoInstallOnAppQuit = false`): installation always waits for an explicit, user-approved restart.

- `updates.getState()` returns the current normalized, non-sensitive updater state (`status`, `enabled`, `version`, `releaseChannel`, bounded `message`, `progress`, `checkedAt`).
- `updates.check()` requests a check for the configured channel.
- `updates.download()` requests download of an available update (no-op unless one is available).
- `updates.install()` requests the user-approved quit-and-install of a downloaded update.
- `updates.onStateChange(callback)` receives validated updater-state pushes and returns unsubscribe.

The bridge never exposes `autoUpdater`, feed URLs, artifact paths, signing material, or raw Electron objects. Main-process handlers verify the sender; the pushed state is shape-validated in preload before reaching the renderer. Signature/checksum verification (SHA-512 feed manifest plus the platform publisher signature) is never bypassed. The committed build ships with `publish: null`, so no feed is configured until an operator sets one for a signed release.

## Activity presence

`activity.getSnapshot()` returns a normalized Windows activity probe for status text (`kind`, `statusText`, `source`, `title`, `detail`, `supported`). On non-Windows platforms `supported` is false and `kind` is `none`. The main process probes the foreground window plus Windows Media Session (GSMTC); the renderer never receives process lists, window handles, or shell access. Callers should poll only while the user has opted into automatic activity status.

## IPC channels

The contract uses only:

- `picom:window-control`
- `picom:window-is-maximized`
- `picom:window-maximize-state-changed`
- `picom:screen-capture-get-sources`
- `picom:screen-capture-select-source`
- `picom:screen-capture-cancel-selection`
- `picom:notification-show`
- `picom:incoming-call-show`
- `picom:incoming-call-dismiss`
- `picom:incoming-call-respond`
- `picom:incoming-call-action`
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
- `picom:update-get-state`
- `picom:update-check`
- `picom:update-download`
- `picom:update-install`
- `picom:update-state-changed`
- `picom:activity-get-snapshot`

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
