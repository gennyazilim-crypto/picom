# Task 274 - Message editing conflict handling

## Outcome

- Added row-locking compare-and-set edit/delete RPCs with explicit conflict errors.
- Revoked direct authenticated message updates.
- Wired App edit/delete actions to production services.
- Added optimistic edit rollback while preserving the user's inline draft.
- Made local/realtime tombstones terminal so stale updates cannot resurrect deleted messages.
- Kept authoritative edited timestamps and existing compact edited indicator.
- Added static, isolated RLS, and multi-window validation guidance.

## Validation contract

- `npm run messages:editing-conflicts:smoke`
- `npm run realtime:ordering:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- Isolated pgTAP when Supabase CLI is available
