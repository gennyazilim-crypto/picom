# Task 293 - Settings menu completeness review

## Status

MVP settings sections reviewed and completed without a layout redesign.

## Delivered

- Account, Profile, Appearance, Notifications, Voice & Video, Keyboard Shortcuts, Privacy & Safety and Advanced have explicit desktop content.
- Profile save uses the centralized profile service and persists to Supabase when configured, with local settings as the mock/offline projection.
- Voice & Video shows connection, mute, deafen and screen-share state plus connected-only controls.
- Light/dark and accessibility settings continue to persist through `settingsService`.
- Diagnostics and redacted Logs support copy/export/clear actions.
- Working MVP controls no longer use raw placeholder copy; deferred 2FA, digest, device selection, updater, startup/minimize and inactivity features are labeled `Coming soon`.

## Remaining production work

Per-device audio selection, production 2FA, signed auto-update and native inactivity detection remain intentionally disabled. Their visible settings are clearly marked and do not claim production support.
