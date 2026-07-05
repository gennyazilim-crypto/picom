# Electron Native Services

Picom keeps native desktop APIs behind Electron main/preload bridges. React components should call typed renderer services, not Electron APIs directly.

## Notification bridge

- Renderer entry point: `src/services/notificationService.ts`
- Preload bridge: `window.picomDesktop.showNotification()`
- IPC channel: `picom:notification-show`
- Main process API: Electron `Notification`

Safety rules:

- Payloads are validated and length-limited in the main process.
- The renderer does not receive raw Electron objects.
- Notification payloads must not include auth tokens, passwords, LiveKit tokens, Supabase service keys, or private message content beyond intentional user-facing notification text.
- If native notifications are unsupported, the bridge returns a safe error and the renderer can fall back to browser/runtime behavior.

Manual verification:

1. Start Picom in Electron dev mode.
2. Open notification settings or diagnostics if available.
3. Trigger the test notification through `notificationService.showTestNotification()`.
4. Confirm a native desktop notification appears on Windows, Linux, or macOS.
5. Disable notifications in settings and confirm the service suppresses the notification.

## Tray bridge

- Renderer entry point: `src/services/trayService.ts`
- Preload bridge: `window.picomDesktop.tray`
- IPC channels:
  - `picom:tray-set-status`
  - `picom:tray-set-muted`
  - `picom:tray-show-window`
  - `picom:tray-quit`
  - `picom:tray-action`
- Main process APIs: Electron `Tray`, `Menu`, and `BrowserWindow`

Safety rules:

- React components should call `trayService`, not Electron APIs.
- Tray action payloads are validated in preload before reaching renderer callbacks.
- The tray menu can open/focus Picom, change presence placeholder status, toggle muted state, open settings placeholder action, or quit.
- The bridge does not expose raw Electron objects.

Manual verification:

1. Start Picom in Electron dev mode.
2. Confirm the Picom tray icon appears where the OS exposes tray icons.
3. Click `Open Picom` and confirm the window focuses/restores.
4. Change each status and confirm the action is sent through the bridge.
5. Toggle `Mute Notifications` and confirm the tray tooltip/menu state changes.
6. Confirm `Quit` exits the app.

## File bridge

- Renderer entry point: `src/services/fileService.ts`
- Preload bridge: `window.picomDesktop.file`
- IPC channels:
  - `picom:file-pick-images`
  - `picom:file-save-text`
- Main process APIs: Electron `dialog` plus Node `fs` in the main process only

Safety rules:

- React components should call `fileService`, not Electron or Node APIs.
- Picked image file paths are not returned to the renderer.
- The main process validates image extensions and limits returned image data to the MVP 10 MB size limit.
- Only PNG, JPG, JPEG, WEBP, and GIF image files are returned by the native picker.
- Text save payloads are capped and written only after the user confirms the save dialog.

Manual verification:

1. Start Picom in Electron dev mode.
2. Trigger `fileService.pickImages()` from diagnostics or a temporary dev console path.
3. Confirm the native image picker opens and returns selected image files without exposing paths.
4. Trigger `fileService.saveText("picom-test.txt", "Picom file bridge test")`.
5. Confirm the native save dialog opens and writes the selected file.

## Clipboard bridge

- Renderer entry point: `src/services/clipboardService.ts`
- Preload bridge: `window.picomDesktop.clipboard`
- IPC channels:
  - `picom:clipboard-read-text`
  - `picom:clipboard-write-text`
- Main process API: Electron `clipboard`

Safety rules:

- React components should call `clipboardService`, not Electron APIs.
- Clipboard text payloads are validated and capped before the main process writes them.
- Clipboard reads return text only and never expose native clipboard objects.
- The service falls back to the browser Clipboard API when the Electron bridge is unavailable.
- Clipboard payloads should not include passwords, auth tokens, Supabase keys, LiveKit tokens, or other secrets.

Manual verification:

1. Start Picom in Electron dev mode.
2. Trigger `clipboardService.copyText("Picom clipboard bridge test")`.
3. Paste into a safe text field and confirm the text appears.
4. Copy text from another app, trigger `clipboardService.readText()`, and confirm text is returned.
5. Run the same calls in browser dev mode and confirm fallback behavior is safe.

## External link bridge

- Renderer entry point: `src/services/externalLinkService.ts`
- Preload bridge: `window.picomDesktop.externalLinks`
- IPC channel: `picom:external-open-url`
- Main process API: Electron `shell.openExternal`

Safety rules:

- React components should call `externalLinkService`, not `window.open` or Electron APIs directly.
- Only `http` and `https` URLs are allowed by default.
- `javascript:`, `file:`, `data:`, shell-like, and unknown protocols are blocked.
- The main process validates and normalizes URLs again before opening them.
- Browser/dev fallback uses `window.open` with `noopener,noreferrer`.
- Deep links should use a future `deepLinkService`, not this external-link opener.

Manual verification:

1. Start Picom in Electron dev mode.
2. Trigger `externalLinkService.openExternalUrl("https://example.com")`.
3. Confirm the URL opens in the default browser.
4. Trigger `externalLinkService.openExternalUrl("javascript:alert(1)")`.
5. Confirm the service returns a blocked/unsafe result and does not open anything.

## Menu service placeholder

- Renderer entry point: `src/services/menuService.ts`
- Native menu state: intentionally hidden for the MVP custom titlebar shell
- Main process behavior: `Menu.setApplicationMenu(null)` and `setMenuBarVisibility(false)`

Safety rules:

- React components should use `menuService` for future app-menu actions.
- The visible native File/Edit/View menu must remain disabled while Picom uses the custom desktop titlebar.
- The placeholder emits typed menu actions locally and does not expose Electron `Menu` objects.
- Future native menu support should be added through preload/IPC, not direct renderer imports.

Manual verification:

1. Start Picom in Electron dev mode.
2. Confirm no native File/Edit/View/Window menu appears.
3. Confirm the custom Picom titlebar remains visible.
4. In a diagnostics/dev path, call `menuService.getState()` and confirm `nativeMenuVisible` is `false`.
5. Call `menuService.triggerPlaceholderAction("open-settings")` and confirm subscribers receive a typed placeholder action.

## Deep link service placeholder

- Renderer entry point: `src/services/deepLinkService.ts`
- Protocol placeholder: `picom://`
- Native protocol registration: intentionally deferred to the later protocol-handler task

Supported placeholder links:

- `picom://invite/{code}`
- `picom://community/{communityId}`
- `picom://community/{communityId}/channel/{channelId}`
- `picom://community/{communityId}/channel/{channelId}/message/{messageId}`
- `picom://settings`
- `picom://friends`

Safety rules:

- Deep links are parsed and validated before any app action is emitted.
- Only safe alphanumeric, underscore, and hyphen route segments are accepted.
- Unknown protocols and routes are rejected.
- Deep links do not execute commands and do not open external URLs.
- External web URLs must continue to use `externalLinkService`.

Manual verification:

1. Call `deepLinkService.simulateDeepLink("picom://settings")`.
2. Confirm the result is a typed settings action.
3. Call `deepLinkService.simulateDeepLink("picom://community/demo/channel/general/message/msg-1")`.
4. Confirm the result includes community, channel, and message identifiers.
5. Call `deepLinkService.simulateDeepLink("javascript:alert(1)")` and confirm it is rejected.
