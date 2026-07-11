# Task 506 checkpoint

- Added canonical normal voice permissions and retained the legacy speaking alias.
- Added type-aware `voiceRoomsEnabled` safe defaults.
- Enforced join, microphone, screen, private-channel, ban, timeout, and hierarchy decisions in Supabase RPCs.
- Added LiveKit provider mute/remove actions and immutable audit recording.
- Mirrored capabilities and role-gated controls in the renderer.
- Kept Radio broadcasting independent from normal voice rooms.

Validation commands: `node scripts/smoke-voice-screen-permissions.mjs`, `npm run typecheck`, `npm run mock:smoke`, `npm run build`, `npm run qa:smoke`, and `npm run performance:budget:ci`.

Hosted Supabase/LiveKit execution is intentionally not claimed without deployed migrations/functions and staging credentials.

## Verified local results

- Voice permission structural smoke: PASS
- TypeScript: PASS
- Mock smoke: PASS
- Production build: PASS
- QA smoke (including LiveKit and secret boundary checks): PASS
- Supabase structural smoke: PASS; optional reset remains unavailable because Supabase CLI is not installed
- Renderer performance hard caps: PASS (`initialJs` 1631.2 KiB, `initialCss` 233.2 KiB)
