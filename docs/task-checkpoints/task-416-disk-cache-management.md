# Task 416 - Disk Cache Management

## Status

Implemented.

## Scope

- Added `cacheManagementService`.
- Added Settings > Advanced cache management UI.
- Added `docs/disk-cache-management.md`.
- Added `disk-cache:smoke`.

## Safety Notes

- Cache actions preserve auth sessions.
- Cache actions preserve drafts.
- Message/offline cache clearing remains a safe placeholder until durable caches exist.
- Browser HTTP cache remains managed by Electron/Chromium.

## Manual Test

1. Open Settings > Advanced.
2. Confirm Cache Management cards render.
3. Click Refresh cache summary.
4. Click Clear image cache placeholder.
5. Click Clear logs.
6. Confirm the app remains signed in and drafts are not removed.
