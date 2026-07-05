# IPC Security Audit

Task 246 audits Picom's Electron IPC/native bridge surface for the Windows, Linux, and macOS desktop MVP.

## Current security posture

- `contextIsolation` is enabled.
- `nodeIntegration` is disabled.
- Electron `remote` is not used.
- Native File/Edit/View menus remain disabled for the custom Picom titlebar.
- Renderer code accesses native capabilities through `window.picomDesktop` and service wrappers.
- `ipcRenderer` is used only in `electron/preload.cts`.
- `ipcMain` handlers live only in `electron/main.cts`.
- IPC channel names are centralized in `electron/ipcChannels.cts`.
- Preload calls route through a channel allowlist before invoking IPC.

## Exposed bridge areas

- Window controls: minimize, maximize/restore, close.
- Window maximize state events.
- Screen capture source listing.
- Native notifications.
- Tray status/actions.
- Native image file picker and text save dialog.
- Clipboard read/write.
- External URL opener.
- Deep link forwarding.
- Power resume events.

## Validation and safety checks

- Window actions are constrained to `minimize`, `maximize`, and `close`.
- Screen capture returns sanitized source metadata and thumbnails only.
- Notification payloads are length-limited.
- Tray status/action payloads are enum-validated.
- File picker returns image data only and does not expose raw file paths.
- File picker is limited to PNG, JPG, JPEG, WEBP, and GIF.
- Native picked images are capped at the MVP 10 MB limit.
- Text save payloads are capped before writing.
- Clipboard payloads are capped and text-only.
- External links allow only `http` and `https`.
- Deep links allow only the `picom://` protocol and are validated again in the renderer.
- Sleep/wake resume payloads are minimal timestamp events.

## Renderer service boundaries

React components should call these services instead of Electron APIs:

- `windowService`
- `notificationService`
- `trayService`
- `fileService`
- `clipboardService`
- `externalLinkService`
- `deepLinkService`
- `updateService`
- `menuService`
- `loggingService`
- `sleepWakeResumeService`

## Logging and diagnostics

- `loggingService` redacts passwords, tokens, cookies, authorization headers, session values, API keys, service-role values, bearer values, and JWT-like values.
- Crash diagnostics are copied through `clipboardService`.
- Developer diagnostics should not be shown as primary user-facing error copy.

## Remaining risks

- Screen capture thumbnails can reveal desktop contents, so they must remain local UI-only previews.
- Clipboard reads can contain sensitive user data; only user-initiated flows should call clipboard read.
- Native file picker currently converts selected images to data URLs for the renderer. This is acceptable for MVP previews but should be revisited for large uploads.
- Future protocol-handler work must keep deep links validation-only and must never execute shell commands.
- Future native menu/updater work must keep payload validation and avoid exposing raw Electron objects.

## Manual verification checklist

1. Run `npm run typecheck`.
2. Run `npm run build`.
3. Confirm `electron/main.cts` has `contextIsolation: true`.
4. Confirm `electron/main.cts` has `nodeIntegration: false`.
5. Confirm `electron/preload.cts` exposes only the typed `picomDesktop` bridge.
6. Confirm React components do not import from `electron`.
7. Confirm native service calls go through renderer services.
8. Confirm no secrets, signing keys, certificates, or production credentials are committed.
