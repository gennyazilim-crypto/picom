# Task 182: Threads production

## Completed

- Added atomic start/open and permission-checked reply RPCs.
- Added latest-100 thread message loading and realtime deduplication.
- Added per-user read state and reply/unread summary.
- Prevented thread replies from entering main chat queries or realtime events.
- Preserved the existing desktop ThreadPanel and main chat layout.

## Verification

- `npm run threads:placeholder:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
