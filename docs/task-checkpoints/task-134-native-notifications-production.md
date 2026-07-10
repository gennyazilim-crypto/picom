# Task 134 - Native Notifications Production

## Result

Completed. Native delivery remains behind `notificationService` and the whitelisted preload bridge. It now honors the emergency native-notification kill switch, and main rejects notification IPC from untrusted renderer URLs. Existing DND, Quiet Hours, active-channel suppression, mention priority, mute, and digest routing remain centralized.

## Changed files

- `src/services/notificationService.ts`
- `electron/main.cts`
- `scripts/native-notifications-smoke-test.mjs`
- `docs/desktop/native-notifications-production.md`
- `docs/task-checkpoints/task-134-native-notifications-production.md`

## Verification

- `npm run native-notifications:smoke`
- `npm run notifications:routing:smoke`
- `npm run renderer:native:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

OS-level display and permission behavior still require installed Windows/Linux/macOS artifact testing; structural smoke cannot prove native notification-center delivery.
