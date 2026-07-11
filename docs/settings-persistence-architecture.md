# Picom Settings Persistence Architecture

## Canonical Owner

`settingsService` is the canonical facade for Picom's app-level settings schema, local migration, safe recovery, account preference hydration, and Settings section routing. Components receive/update settings through this service or a domain service explicitly listed below; components do not write browser storage or Supabase directly.

## Persistence Scopes

| Setting family | Scope | Canonical persistence |
| --- | --- | --- |
| Theme | Local device | Versioned `picom-settings` document |
| First-launch completion | Local device | Versioned `picom-settings` document |
| Accessibility | Local device | Versioned `picom-settings` document |
| Notification preferences | User account synced | Local optimistic document plus RLS-owned `user_settings` row |
| Profile fields/media | User account synced | `profileService` and RLS-owned `profiles` data; settings stores only a local UI mirror |
| Community notification/mute policy | Community-specific | `notificationPolicyStateService` and its community/channel identifiers |
| Voice device choices | Local device/native | `voiceService` and native device APIs |
| Privacy/profile visibility/DM policy | User account synced | Respective safety/privacy service and RLS API |
| Feature flags, maintenance, release/update policy | Server-controlled | Remote config/feature flag/update services; user settings cannot override them |

## Local Schema and Migration

- Current schema: version 7.
- Migrations run sequentially from the stored version.
- Legacy Picom theme and first-launch keys are imported when the canonical document is absent.
- Existing first-launch completion is preserved during migration.
- Future-version or unmigratable documents fail closed to safe defaults.
- Reads and writes are guarded; unavailable storage retains safe in-memory settings for the current session.

## Corruption Recovery

Malformed JSON is removed and safe defaults are returned without crashing startup or forcing Safe Mode. Recovery evidence stores only reason, byte length, and timestamp. Raw settings content is not copied because it could contain user-entered profile text.

## Account Synchronization

Only account-scoped notification preferences are stored in `user_settings`. Theme, first-launch state, accessibility, community state, and server controls are deliberately excluded. Supabase RLS permits select/insert/update only when `user_id = auth.uid()`.

Mock mode keeps the same service API and resolves account synchronization locally. Supabase mode hydrates after authenticated session restore and writes account preferences after local optimistic updates.

## Community and Server-Controlled Settings

Community-specific and server-controlled settings remain with their mature domain services. This is intentional ownership, not duplicate app settings state. `settingsPersistenceRegistry` records the scope boundary so future settings do not silently choose ad-hoc storage.
