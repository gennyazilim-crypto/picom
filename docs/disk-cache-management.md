# Disk Cache Management Foundation

Picom cache controls are designed for a long-running Windows/Linux/macOS desktop app. The MVP foundation exposes safe local actions without deleting identity, auth sessions, or user drafts.

## Settings Entry

Settings > Advanced includes a Cache Management section with:

- cache size estimate placeholder
- image cache metadata count
- recent redacted log count
- clear image cache placeholder
- clear message cache placeholder
- clear logs
- clear all non-essential cache

## Service

`cacheManagementService` exposes:

- `getCacheSummary()`
- `clearImageCache()`
- `clearMessageCache()`
- `clearLogs()`
- `clearAllNonEssentialCache()`

## Safety Rules

- Cache actions must not clear auth sessions.
- Cache actions must not log users out.
- Cache actions must not delete message drafts.
- Cache actions must not remove user profile settings.
- Private attachment files are not cached by Picom-owned persistent storage in the MVP.
- Browser/Chromium HTTP cache remains runtime-managed.

## Current Implementation

- Image cache clearing resets the bounded metadata-only `imageCacheService`.
- Logs clearing resets the in-memory redacted logging buffer.
- Message cache clearing is a safe placeholder because Picom does not yet maintain a durable message cache.
- Offline data clearing is a placeholder because Picom does not yet maintain a durable offline queue.

## Future Native Disk Cache

Before adding a real native disk cache:

- add a maximum disk size
- add per-cache category sizes
- validate every delete path
- keep auth/session storage separate
- add explicit confirmation before deleting drafts
- block clearing private media without access-aware invalidation

## QA

1. Open Settings > Advanced.
2. Confirm Cache Management shows an estimate or `Not available`.
3. Clear image cache and confirm the app remains signed in.
4. Clear logs and confirm diagnostics still opens safely.
5. Clear all non-essential cache and confirm drafts/auth are preserved.
