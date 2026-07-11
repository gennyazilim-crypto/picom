# Task 513 - Supabase Unified Feed and Mentions Integration

## Status

Implemented. Hosted migration and real pgTAP execution remain environment-dependent.

## Completed

- Preserved the RLS-invoker unified Text, Radio, and Podcast Feed RPC.
- Added one-row look-ahead pagination so exact terminal pages do not expose empty cursors.
- Kept the public page size at 50 while preventing the look-ahead row from reaching UI data.
- Added Realtime invalidation for follows, audio saves, and audio read states.
- Added complete replica identities and idempotent publication registration for those state tables.
- Added a source/ranking index and structural plus pgTAP regression contracts.
- Preserved mock mode, tabs, filters, deep links, cache bounds, and subscription cleanup.

## Security

- Feed reads remain source-authorized through RLS and security-invoker views/functions.
- Realtime events only trigger an authoritative refetch; they never grant source access.
- Components continue to use service layers instead of direct Supabase table calls.

## External validation

Applying the migration to hosted staging and executing pgTAP require an available Supabase CLI/project. Missing external access must be reported as `BLOCKED`, never as passed.

## Validation evidence

- `node scripts/supabase-feed-mentions-production-integration-smoke.mjs`: PASS
- `npm run feed:query:smoke`: PASS
- `npm run feed:realtime:cache:smoke`: PASS
- `npm run supabase:migrations:check`: PASS
- `npm run supabase:rls:smoke`: PASS structurally; real pgTAP BLOCKED because Supabase CLI is unavailable
- `npm run supabase:api-regression`: PASS
- `npm run supabase:qa`: PASS with the same explicit CLI warning
- `npm run typecheck`: PASS
- `npm run mock:smoke`: PASS
- `npm run build`: PASS
- `npm run qa:smoke`: PASS
- `npm run feed:full-mvp:qa`: BLOCKED by the pre-existing story-row CSS text contract while `MentionFeedMain.css` is being changed concurrently outside this task
- `npm run performance:budget:ci`: FAIL in the shared dirty worktree (`initialJs` 1754.1 KiB, `initialCss` 240.8 KiB); no budget was raised and no unrelated UI/import work was changed

## Manual results

Service-level pagination, source coverage, cache invalidation, migration ordering, and privacy contracts were exercised by deterministic smoke tests. Hosted Feed reads, two-client Realtime behavior, and migration application remain BLOCKED until an authorized Supabase staging environment and CLI are available.
