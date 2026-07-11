# Task 457 Checkpoint: Podcast Cross-Surface Integration

Date: 2026-07-11

## Result

Completed the Podcast integration across Mention Feed, Profile, Podcast Community, Advanced Search, exact deep links, and notification routing without introducing a second episode state system.

## Implemented

- Added Podcast mention metadata to the canonical audio feed projection.
- Detects viewer mentions in published episode descriptions and visible comments.
- Added compact Podcast mention context to normal Mention Feed cards while retaining listeners/views, reactions, commenter avatars, comments, read state, and save state.
- Added exact `Open episode` and separate `Open community` actions.
- Kept Profile and Podcast Community projections synchronized with the canonical audio service.
- Added local and Supabase-backed Podcast search results with exact episode IDs.
- Added `picom://podcast/{communityId}/episode/{episodeId}` parsing and bounded Electron main/preload validation.
- Added one access-checked renderer navigation function for Search, deep links, and notifications.
- Added exact Podcast episode context to notification inbox types and service mapping.
- Added database mention producers for published descriptions and visible comments, with community membership, self-mention, blocking, bounded metadata, and idempotency checks.
- Added a pgTAP-shaped schema contract and a deterministic cross-surface smoke test.

## Privacy and security

- Draft, archived, deleted, and inaccessible episodes are not opened by cross-surface routes.
- Deep-link syntax validation is followed by service/RLS access validation.
- Podcast UI components do not call Supabase directly.
- Mention notifications are limited to community members and suppress blocked relationships.
- Notification metadata does not contain private audio URLs.

## Commands and results

- `npm run podcast:integration:smoke` - PASS
- `npm run podcast:interactions:smoke` - PASS
- `npm run podcast:player:smoke` - PASS
- `npm run podcast:publishing:smoke` - PASS
- `npm run podcast:data-model:smoke` - PASS
- `npm run audio:feed:smoke` - PASS
- `npm run audio:profile:smoke` - PASS
- `npm run audio:community:smoke` - PASS
- `npm run audio:podcast:smoke` - PASS
- `npm run search:palette:production:test` - PASS
- `npm run protocol-handler:smoke` - PASS
- `npm run electron:ipc-fuzz:test` - PASS
- `npm run notifications:routing:smoke` - PASS
- `npm run mock:smoke` - PASS
- `npm run supabase:smoke` - PASS (structural schema smoke)
- `npm run typecheck` - PASS
- `npm run build` - PASS
- `npm run qa:smoke` - PASS
- `npm run performance:budget:ci` - PASS

Performance evidence:

- Initial JS: 1521.3 KiB (under 1650.0 KiB hard cap)
- Initial CSS: 227.3 KiB (under 240.0 KiB hard cap)
- Largest image: 734.6 KiB (under 768.0 KiB hard cap)
- Total assets: 2959.7 KiB (under 3500.0 KiB hard cap)
- Generated assets: 35

## Blocked external evidence

The Supabase CLI is not installed in this environment. The migration and pgTAP contracts are present and structurally validated, but live migration application, hosted pgTAP execution, and cross-account RLS verification remain blocked. They must be run against the protected Supabase validation environment before release and are not claimed as passed here.

## Remaining non-blocking warnings

- Vite reports an ineffective dynamic import for `voiceService`; unrelated to Task 457.
- Initial JS/CSS and total assets are above preferred targets but below enforced hard caps.
- The largest renderer entry chunk remains above Vite's advisory 500 KiB warning.
