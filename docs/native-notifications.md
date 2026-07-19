# Native Desktop Notifications

Picom sends desktop notifications through a centralized `notificationService`. React components must not call Electron, `ipcRenderer`, or browser notification APIs directly.

## Incoming voice calls

When Picom is unfocused, minimized, or closed to the tray, an incoming call also opens a Mark-style always-on-top toast window (`picomDesktop.incomingCall`) in the bottom-right of the screen. Answer / Message / Decline actions focus the main window and complete through the existing voice-call invite flow. A silent OS notification is shown in parallel so Windows Action Center still records the call.

## Runtime flow

1. UI or app logic calls `notificationService.showNotification()`.
2. `notificationService` evaluates local notification settings and optional routing context.
3. If the Electron bridge is available, it calls `window.picomDesktop.showNotification()`.
4. Preload forwards the request through the whitelisted `picom:notification-show` IPC channel.
5. Electron main validates and length-limits the payload.
6. Electron main uses `new Notification(...)` and returns a safe result.
7. If the native bridge is unavailable, the service falls back to the browser `Notification` API where supported.

## Supported notification categories

- `system`
- `mention`
- `message`

## Routing controls

`notificationService.showNotification()` supports optional routing metadata:

```ts
notificationService.showNotification({
  title: "Picom",
  body: "You were mentioned.",
  category: "mention",
  routing: {
    appFocused: false,
    activeChannelId: "general",
    eventChannelId: "announcements",
    isMention: true,
    doNotDisturb: false,
  },
});
```

The routing helper respects:

- notifications disabled
- muted notification setting
- mentions-only setting
- channel/community mute hints
- active channel and near-bottom state
- do-not-disturb hint

## Security rules

- Notification payloads are validated and length-limited in Electron main.
- The renderer does not receive raw Electron objects.
- Notification payloads must not contain passwords, auth tokens, Supabase service-role keys, LiveKit tokens, signed URLs, or raw authorization headers.
- Message content should be limited to intentional user-facing notification text.
- Native notification failures return safe error codes and must not crash the app.

## Manual test steps

1. Run `npm run native-notifications:smoke`.
2. Run `npm run electron:dev`.
3. Open Settings > Notifications.
4. Click the test notification action.
5. Confirm a native desktop notification appears when notifications are enabled.
6. Toggle notifications off or muted and confirm the service suppresses the notification with a clean message.

## Known platform notes

- Windows and Linux notifications depend on OS notification settings.
- macOS may suppress notifications depending on system Focus/DND settings.
- Electron native notifications do not require exposing provider credentials to the renderer.
