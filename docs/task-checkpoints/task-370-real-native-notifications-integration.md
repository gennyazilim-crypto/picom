# Task 370 Checkpoint: Real Native Notifications Integration

## Status

Completed the smallest safe native-notification integration hardening. The existing Electron preload/main bridge is now documented, smoke-tested, and the renderer service treats the native bridge as the preferred permission path.

## Changed files

- `src/services/notificationService.ts`
- `docs/native-notifications.md`
- `scripts/native-notifications-smoke-test.mjs`
- `docs/task-checkpoints/task-370-real-native-notifications-integration.md`
- `package.json`

## Commands run

```bash
npm run native-notifications:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

## How to test manually

1. Run `npm run electron:dev`.
2. Open Settings > Notifications.
3. Click the test notification action.
4. Confirm a native desktop notification appears when enabled.
5. Toggle notification mute/disabled settings and confirm the service suppresses notifications cleanly.

## Notes

React components continue to use `notificationService`; no component directly calls Electron APIs. OS notification preferences may still suppress native notifications on Windows, Linux, or macOS.
