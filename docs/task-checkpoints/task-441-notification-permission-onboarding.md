# Task 441 Checkpoint: Notification Permission Onboarding

## Summary

Added a local notification permission onboarding foundation that asks at contextual moments instead of app startup.

## Scope

- Added onboarding state service with persisted dismissal.
- Added compact desktop notification permission prompt.
- Wired prompt triggers for community creation, first message send, and Settings > Notifications.
- Permission requests go through `notificationService.requestPermission()`.
- Added documentation and smoke verification.

## Files changed

- `src/services/notificationPermissionOnboardingService.ts`
- `src/components/NotificationPermissionPrompt.tsx`
- `src/App.tsx`
- `src/styles.css`
- `docs/notification-permission-onboarding.md`
- `scripts/notification-permission-onboarding-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-441-notification-permission-onboarding.md`

## Validation

- `npm run notifications:permission-onboarding:smoke`
- `npm run react:hooks:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- No permission is requested on startup.
- Dismissal is local and persistent.
- No mobile UI or unrelated notification feature was added.

