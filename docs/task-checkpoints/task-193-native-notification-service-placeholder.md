# Task 193 - Native notification service placeholder

## Scope

- Expanded `notificationService` into the single renderer-facing notification abstraction.
- Kept React components away from direct native/browser notification API calls.
- Preserved safe fallback behavior when notifications are unavailable or denied.

## Implementation notes

- `notificationService.showNotification()` accepts a typed payload.
- The service checks local notification settings before requesting permission.
- The service reports runtime, platform, permission and settings through `getStatus()`.
- Future Electron preload or native main-process notification IPC can replace the internal implementation without changing UI callers.

## Manual verification

- Open Settings > Notifications.
- Keep notifications enabled and click "Send test notification".
- Toggle "Mute notifications" and click the test button again.
- Confirm Picom shows toast feedback instead of crashing when notifications are blocked or unavailable.
