# Task 423: Quiet Hours

## Scope

- Added Quiet Hours notification settings.
- Added local-time Quiet Hours routing checks to `notificationService`.
- Added Settings > Notifications UI for start/end time, apply mode, and mention override.
- Documented behavior and added smoke coverage.

## Validation

- `npm run notifications:quiet-hours:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

1. Open Settings > Notifications.
2. Enable Quiet Hours and set a range covering the current local time.
3. Confirm normal message notifications are suppressed when apply mode is `normal_messages_only`.
4. Confirm mentions are allowed if `Allow mentions during Quiet Hours` is enabled.
