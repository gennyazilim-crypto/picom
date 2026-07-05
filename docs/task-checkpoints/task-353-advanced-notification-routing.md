# Task 353 Checkpoint - Advanced Notification Routing

## Status

Completed as a centralized notification decision foundation.

## Changed files

- `src/services/notificationService.ts`
- `docs/advanced-notification-routing.md`
- `scripts/advanced-notification-routing-smoke-test.mjs`
- `docs/task-checkpoints/task-353-advanced-notification-routing.md`
- `package.json`

## What changed

- Added `decideNotificationRoute()` to centralize notification routing decisions.
- `showNotification()` now uses the centralized route before attempting native/browser notification delivery.
- Documented active channel, focus, muted, DND, and mention routing expectations.
- Added a smoke test to verify the routing foundation is present.

## Commands run

- `npm run notifications:routing:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Open Settings > Notifications.
2. Disable notifications and trigger a test notification from diagnostics/settings if available.
3. Confirm the service safely suppresses desktop delivery.
4. Re-enable notifications and confirm existing notification settings still behave normally.

## Notes

- This task does not add new notification UI.
- It does not log message content or secrets.
