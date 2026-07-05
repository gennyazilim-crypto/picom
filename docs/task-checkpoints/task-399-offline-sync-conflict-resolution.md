# Task 399 - Offline sync conflict resolution

## Summary

Prepared a small conflict-classification foundation for offline or failed sync actions without adding a full offline queue.

## Changes

- Added `offlineSyncConflictService`.
- Added typed conflict codes and recovery action hints.
- Routed message send failures through the conflict classifier for cleaner user-facing copy.
- Documented future queue requirements and conflict behavior.
- Added a smoke test for the conflict foundation.

## Verification

Commands to run:

```powershell
npm run offline:conflicts:smoke
npm run typecheck
npm run build
```

Manual verification:

1. Run Picom in Supabase mode with an unavailable backend.
2. Try sending a message.
3. Confirm the toast explains the connection/sync issue clearly.
4. Restore backend connectivity and confirm normal message send still works.

## Known limitations

- No full offline queue is implemented yet.
- Failed message retry/remove row UI remains a later reliability task.
