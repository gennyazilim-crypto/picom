# Notification inbox production integration

Picom keeps the existing compact desktop inbox and adds a recipient-owned Supabase data path. `notificationCenterService` remains the UI-facing abstraction and localStorage remains the cache/fallback when Supabase is disabled or unreachable.

## Data flow

- `notificationInboxService.list()` reads at most 250 non-deleted rows allowed by recipient RLS.
- INSERT/UPDATE/DELETE realtime changes trigger a bounded full refresh rather than applying untrusted payload fields directly.
- Mark read, mark all read, and remove are optimistic locally. Production removal sets `deleted_at`; it does not hard-delete the audit-relevant event immediately.
- A successful remote response replaces the cached inbox. A failed response leaves the last local cache intact.

## Preferences and DND

Local producers pass through `decideNotificationRoute`. Disabled notifications do not add inbox items. DND, Quiet Hours, muted channels, mentions-only, and digest routing can suppress native delivery while retaining the inbox record where the central decision requires it.

The backend stores inbox rows only. It never calls Electron, browser, Windows, Linux, or macOS notification APIs. Native delivery remains inside `notificationService` in the desktop client.

## Security

- Only the recipient can select or update a notification row.
- Authenticated clients have no INSERT grant; trusted backend/database producers create rows.
- UI components do not call Supabase directly.
- Rows must not contain tokens, credentials, authorization headers, or unrestricted message bodies.

Hosted RLS and realtime behavior must be tested after applying the migration; this repository does not claim a hosted pass without Supabase CLI/environment access.
