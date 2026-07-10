# Task 185: Saved messages sync

## Completed

- Added authorized Supabase saved-message snapshots and realtime refresh.
- Unified context-menu and Mention Feed save/unsave behavior.
- Added Saved view Unsave and current-access filtering.
- Purged inaccessible/deleted private content from synchronized cache.
- Preserved idempotent mock and Supabase behavior.

## Verification

- `npm run saved:messages:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
