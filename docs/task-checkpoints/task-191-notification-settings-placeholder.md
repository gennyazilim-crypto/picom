# Task 191 Checkpoint - Notification Settings Placeholder

## Completed

- Expanded local notification settings with:
  - `enabled`
  - `muted`
  - `mentionsOnly`
- Added `settingsService.updateNotificationSettings()` for safe nested settings persistence.
- Settings migration/defaulting now preserves old local settings while adding missing notification fields.
- Settings > Notifications now shows desktop-native placeholder toggles.
- Test notification action remains available through `notificationService`.

## Manual verification

1. Open Settings > Notifications.
2. Toggle each notification setting.
3. Close and reopen settings and confirm values persist.
4. Reload the app and confirm values still persist.
5. Click Send test notification and confirm success/error toast appears.

## Notes

- This task does not implement full notification routing.
- Future notification routing can read `settingsService.getSettings().notificationSettings`.
- No native desktop APIs are called directly from React components.