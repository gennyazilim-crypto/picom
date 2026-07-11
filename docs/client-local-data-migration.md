# Client Local Data Migration

Picom stores non-sensitive desktop UI settings in local storage. Task 379 adds a small schema-versioned migration path so older settings do not crash app startup.

## Current local settings schema

- Storage key: `picom-settings`.
- Settings schema version: `9`.
- Coordinated local-data manifest version: `2` (`picom:local-data-schema:v2`).
- Data covered:
  - theme
  - notification preferences
  - profile display placeholders
  - accessibility display preferences
  - local keyboard shortcut preferences through their independent bounded store
  - draft key/record normalization
  - non-sensitive remote-config cache metadata validation

## Migration policy

- Settings without `schemaVersion` are treated as version `0`.
- Version `0 -> 1` adds the initial schema marker.
- Version `1 -> 2` ensures accessibility settings exist after the high contrast/reduced motion task.
- Settings versions `2 -> 9` append bounded migrations for notification routing, first-launch state, profile/account settings, accessibility, appearance, and Full MVP notification preferences.
- Future migrations should be appended to `localSettingsMigrations`.
- Unknown future versions reset to safe defaults rather than guessing.

## Corruption handling

- If JSON parsing fails, Picom backs up the raw value under `picom-settings.backup.<timestamp>`.
- The active settings key is then cleared so startup can continue with safe defaults.
- Backup data is capped before storage to avoid unbounded local growth.
- Coordinated migration backups are restricted to settings, drafts, cache metadata, and the migration manifest; at most five 12,000-character backup values are retained.
- Invalid drafts/cache metadata reset only their own scope so one bad value cannot block startup.

## Security boundary

- Auth tokens, passwords, session secrets, Supabase privileged keys, LiveKit credentials, and desktop signing data must never be migrated here.
- This migration path is only for renderer-safe UI preferences.
- Account/session state remains owned by the auth/data source layer.
- Supabase auth storage, access/refresh tokens, passwords, authorization headers, LiveKit credentials, signing keys, and provider secrets are not enumerated, read, copied, reset, or migrated by `localDataMigrationService`.

## Manual QA

1. Start the app with no `picom-settings` value and confirm defaults load.
2. Save theme/accessibility preferences and reload the app.
3. Simulate an old settings payload without `schemaVersion`; confirm it migrates to settings version `9` and manifest version `2`.
4. Simulate corrupted JSON; confirm the app starts with defaults and a backup key is created.
5. Add legacy draft keys (`communityId:channelId`) and confirm they normalize without losing text.
6. Corrupt remote-config cache metadata and confirm only that cache scope resets.
7. Confirm no auth/session state is changed.
