# Task 518 - Mock and Supabase Data Source Final Cleanup

## Status

Complete locally.

## Completed

- Replaced implicit mock fallback with an explicit `mock`/`supabase` runtime decision.
- Missing or invalid `VITE_DATA_SOURCE` now resolves to unconfigured Supabase and a clear reason.
- Added one centralized mock-fixture gate for Community, Feed, stories, Friends, DM, events, profile, sticker, and unified-mention startup data.
- Supabase mode begins with empty domain collections instead of displaying fake content.
- Removed generated profile fields from production fallback state.
- Routed diagnostics, maintenance status, and network health through the authoritative data-source service.
- Removed the misleading backend-failure claim that mock UI remained available.
- Added an automated no-silent-fallback audit while preserving deterministic explicit mock mode.

## Validation

Passed:

- `node scripts/data-source-final-cleanup-smoke.mjs`
- `npm run mock:smoke`
- `npm run supabase:api-regression`
- `npm run supabase:qa`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

Failed/blocked:

- `npm run performance:budget:ci`: FAILED on the shared dirty renderer state at `initialJs 1757.0 KiB` (1650.0 KiB cap) and `initialCss 240.8 KiB` (240.0 KiB cap). The budget was not disabled or raised. Task 518 adds no UI feature and does not absorb unrelated concurrent UI optimization work.

Manual live Supabase verification was not run because no approved hosted credentials are available. The static production-mode audit and Supabase API regression passed; no hosted success is claimed.
