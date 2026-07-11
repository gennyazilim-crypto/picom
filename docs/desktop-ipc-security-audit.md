# Desktop IPC Security Audit

Picom uses Electron with a custom desktop shell. This audit records the current renderer/native bridge posture and the remaining IPC risks for the Windows, Linux, and macOS MVP.

## Scope

Reviewed files:

- `electron/main.cts`
- `electron/preload.cts`
- `electron/ipcChannels.cts`
- `electron/appConfig.cts`
- `scripts/electron-security-smoke-test.mjs`

This task is documentation and verification only. No renderer UI behavior changed.

## Current Electron security posture

| Area | Current state | Assessment |
| --- | --- | --- |
| Native menu/chrome | `Menu.setApplicationMenu(null)`, `autoHideMenuBar: true`, `setMenuBarVisibility(false)` | Good for custom desktop titlebar. |
| Renderer isolation | `contextIsolation: true` | Required and present. |
| Node access | `nodeIntegration: false` | Required and present. |
| Sandbox | `sandbox: true` | Required and present. |
| Web security | `webSecurity: true`, `allowRunningInsecureContent: false` | Required and present. |
| Preload bridge | `contextBridge.exposeInMainWorld("picomDesktop", Object.freeze(bridge))` | Good, minimal named bridge. |
| IPC channels | Centralized in `electron/ipcChannels.cts` | Good; whitelist helper exists. |
| Navigation control | `will-navigate` blocks untrusted app URLs and opens safe external URLs | Good. |
| New windows | `setWindowOpenHandler` denies renderer-created windows | Good. |
| Webviews | `will-attach-webview` prevents webview attachment | Good. |
| External links | Only `http:` and `https:` survive normalization | Good baseline. |
| Deep links | `picom://` route and segment validation exists | Good baseline. |

## IPC channel review

### Window controls

- Channel: `picom:window-control`
- Allowed actions: `minimize`, `maximize`, `close`
- Risk: Low.
- Notes: Main process validates action string and resolves the BrowserWindow from `event.sender`.

### Window maximize state

- Channels: `picom:window-is-maximized`, `picom:window-maximize-state-changed`
- Risk: Low.
- Notes: Renderer receives boolean state only.

### Screen capture sources and selection

- Channels: `picom:screen-capture-get-sources`, `picom:screen-capture-select-source`, `picom:screen-capture-cancel-selection`
- Risk: Medium.
- Notes: Required for MVP screen sharing. Main returns bounded source id, name, type, thumbnail, and app icon only after a focused explicit action. Selection is restricted to a one-use, 60-second, WebContents-bound source session; cancel invalidates it. macOS denial is checked before enumeration.

### Native notifications

- Channel: `picom:notification-show`
- Risk: Low.
- Notes: Payload title/body are trimmed and length-limited before creating a notification.

### Tray actions

- Channels: `picom:tray-*`, `picom:tray-action`
- Risk: Low.
- Notes: Status values are enum-validated. Tray actions forward only action/status/muted metadata.

### File picker and save dialog

- Channels: `picom:file-pick-images`, `picom:file-save-text`
- Risk: Medium.
- Notes: Image picking is extension/MIME constrained and capped to four files with a 10 MB per-file native limit. Save text uses a native save dialog and sanitizes default file names.
- TODO: Keep future file types centralized in upload/file validation.

### Clipboard

- Channels: `picom:clipboard-read-text`, `picom:clipboard-write-text`
- Risk: Medium.
- Notes: Text length is capped to avoid unbounded payloads. User-facing flows should avoid automatically reading clipboard without user action.

### External links

- Channel: `picom:external-open-url`
- Risk: Low to medium.
- Notes: `http:` and `https:` are allowed; `javascript:`, `file:`, `data:`, and unknown protocols are rejected.
- TODO: Keep all renderer link opening routed through `externalLinkService`.

### Deep links

- Channel: `picom:deep-link-open`
- Risk: Medium.
- Notes: Protocol and route validation exists. Incoming URLs are never executed as shell commands.
- TODO: Keep unknown links as safe no-op/user error states.

### Power resume

- Channel: `picom:power-resume`
- Risk: Low.
- Notes: Payload contains timestamp only.

## Renderer native API rule

React components should not import Electron or call native APIs directly. The approved path is:

```text
React component
  -> src/services/*
    -> window.picomDesktop bridge
      -> preload whitelist
        -> ipcMain handler
```

The current grep did not show direct renderer imports from Electron. Keep this as a CI/smoke expectation.

## Security assumptions

- Renderer code is not trusted with Node APIs.
- Supabase service-role credentials never run in the renderer.
- File system access must always be user-mediated through dialogs.
- Screen capture must always be user-mediated through an explicit picker.
- External URLs must be normalized before leaving the app.
- IPC payloads must be treated as untrusted in main process handlers.

## Remaining risks

- No full production CSP enforcement is captured in this IPC audit.
- Screen capture thumbnails may expose visible desktop content after the user opens the picker.
- Clipboard read can reveal user clipboard text if a UI action calls it unexpectedly.
- Future IPC channels could bypass whitelist discipline if added outside `electron/ipcChannels.cts`.
- Native notification permission and platform behavior vary by operating system.

## Required checks

```bash
npm run desktop:ipc:security:smoke
npm run electron:security:smoke
npm run typecheck
npm run build
```

## Decision

Keep the current Electron bridge model. Do not expose raw Electron objects, Node APIs, arbitrary file system access, shell execution, or unvalidated URL handling to the renderer.
