# Task 275 - Realtime event deduplication hardening

## Outcome

- Retained bounded message ID, clientMessageId, and event ID duplicate guards.
- Added generation ownership to reject late callbacks after channel/community/view changes.
- Disabled channel message subscriptions outside the community view.
- Invalidated ownership before async Supabase channel removal.
- Added content-free lifecycle and aggregate duplicate/stale diagnostics.
- Added static checks and an explicit two-window reconnect/view-switch procedure.

## Validation contract

- `npm run realtime:deduplication:smoke`
- `npm run realtime:ordering:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- Manual two-window test when Supabase is available
