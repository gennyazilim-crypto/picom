# Task 515 - Supabase Realtime Presence, Typing, Unread, and Cleanup

## Status

Implemented locally. Hosted two-client execution is BLOCKED pending authorized staging credentials.

## Completed

- Centralized Full MVP Realtime topic builders.
- Authorized private DM typing for active participants.
- Authorized canonical community-wide unread topics without weakening source RLS.
- Replaced primary-role-only private-channel checks with subject-scoped mature multi-role permissions and overrides.
- Synchronized refreshed auth tokens with Realtime and removed channels on sign-out.
- Prevented stale friend-presence cleanup from overwriting a replacement subscription.
- Preserved typing throttle/TTL, ordering, optimistic deduplication, reconnect, and cleanup behavior.
- Added privacy-safe active/duplicate channel diagnostics.
- Added migration, pgTAP, structural, staging-contract, and service smoke coverage.

## Validation evidence

- `node scripts/supabase-realtime-presence-integration-smoke.mjs`: PASS
- `npm run realtime:staging:contract:test`: PASS
- `npm run realtime-scaling:smoke`: PASS
- `npm run realtime:ordering:smoke`: PASS
- `npm run realtime:deduplication:smoke`: PASS
- `npm run read-state:smoke`: PASS
- `npm run presence:accuracy:test`: PASS
- `npm run realtime:load:smoke`: PASS
- `npm run realtime:backpressure:smoke`: PASS
- `npm run dm:services:realtime:smoke`: PASS
- `npm run radio:service-realtime:smoke`: PASS
- `npm run realtime:staging:preflight`: PASS; no network call, credentials, or identifiers were printed
- `npm run supabase:migrations:check`: PASS
- `npm run supabase:rls:smoke`: PASS structurally; real pgTAP BLOCKED because Supabase CLI is unavailable
- `npm run supabase:api-regression`: PASS
- `npm run supabase:qa`: PASS with the explicit CLI warning
- `npm run typecheck`: PASS
- `npm run mock:smoke`: PASS
- `npm run build`: PASS
- `npm run qa:smoke`: PASS
- `npm run performance:budget:ci`: FAIL in the shared dirty worktree (`initialJs` 1755.7 KiB, `initialCss` 240.8 KiB); no limit or unrelated UI/import was changed

## Manual and hosted results

Deterministic contracts prove topic construction, deny-by-default authorization, deduplication, ordering, cleanup, reconnect state, and bounded diagnostics. A real two-client hosted session is BLOCKED until the documented staging URL, anon key, two test accounts, community/channel fixtures, and explicit `STAGING_ONLY` confirmation are available.
