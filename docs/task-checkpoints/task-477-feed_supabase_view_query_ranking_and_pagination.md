# Task 477 Checkpoint: Feed Supabase View, Query, Ranking, and Pagination

## Delivered
- RLS-invoker unified Feed view and one ranked RPC across all mention kinds.
- Popular and persisted-following modes with bounded engagement/recency ranking.
- Stable score/time/ID keyset cursor and refresh ranking epoch.
- Mock/Supabase service, explicit empty states, and retained deep-link source IDs.
- Index/no-N+1 documentation plus pgTAP and static contracts.

## Commands
- `npm run feed:query:smoke`
- `npm run mentions:unified:smoke`
- `npm run mentions:ranking:test`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Live Supabase pgTAP remains BLOCKED until CLI and staging credentials are available. No hosted result is claimed.
