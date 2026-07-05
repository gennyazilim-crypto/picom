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
