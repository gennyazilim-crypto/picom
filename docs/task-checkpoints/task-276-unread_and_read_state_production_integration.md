# Task 276 checkpoint: unread and read-state production integration

## Completed

- Added RLS-safe `read_states` policies and read/write RPCs.
- Added a renderer-safe read-state service with mock fallback.
- Added community-wide visible-channel INSERT coverage for inactive unread state.
- Added near-bottom detection so active channels only advance read markers when actually being read.
- Kept unread dots and mention counts separate, with cumulative mention updates.
- Added production contract documentation and a static smoke test.

## Verification

- `npm run read-state:smoke`
- `npm run realtime:deduplication:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining environment check

Apply the migration in a Supabase test project, then complete the documented two-window RLS test. Supabase CLI availability is not assumed and no hosted result is claimed by this checkpoint.
