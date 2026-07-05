# Client Local Data Migration

Picom stores non-sensitive desktop UI settings in local storage. Task 379 adds a small schema-versioned migration path so older settings do not crash app startup.

## Current local settings schema

- Storage key: `picom-settings`.
- Current schema version: `2`.
- Data covered:
  - theme
  - notification preferences
  - profile display placeholders
  - accessibility display preferences

## Migration policy

- Settings without `schemaVersion` are treated as version `0`.
- Version `0 -> 1` adds the initial schema marker.
- Version `1 -> 2` ensures accessibility settings exist after the high contrast/reduced motion task.
- Future migrations should be appended to `localSettingsMigrations`.
- Unknown future versions reset to safe defaults rather than guessing.

## Corruption handling

- If JSON parsing fails, Picom backs up the raw value under `picom-settings.backup.<timestamp>`.
- The active settings key is then cleared so startup can continue with safe defaults.
- Backup data is capped before storage to avoid unbounded local growth.

## Security boundary

- Auth tokens, passwords, session secrets, Supabase privileged keys, LiveKit credentials, and desktop signing data must never be migrated here.
- This migration path is only for renderer-safe UI preferences.
- Account/session state remains owned by the auth/data source layer.

## Manual QA

1. Start the app with no `picom-settings` value and confirm defaults load.
2. Save theme/accessibility preferences and reload the app.
3. Simulate an old settings payload without `schemaVersion`; confirm it migrates to version `2`.
4. Simulate corrupted JSON; confirm the app starts with defaults and a backup key is created.
5. Confirm no auth/session state is changed.
