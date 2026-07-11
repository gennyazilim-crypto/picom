# Task 535 checkpoint: Secure LiveKit meeting token Edge Function

## Delivered

- JWT-verified, origin-restricted, bounded-JSON `meeting-token` Edge Function.
- Server-side room/session/community authorization with waiting-room admission, capacity, ban/timeout/block, join-policy, role, and capability enforcement.
- Canonical room name and authenticated user identity; the renderer cannot override either.
- Five-minute least-privilege subscribe, microphone, camera, screen-share/audio, and data grants.
- Waiting response without provider token; denied responses without provider metadata.
- Typed renderer service, generated DB function contract, release manifest/config registration, structural SQL test, and allowed/waiting/blocked staging runner.

## Validation status

- `node scripts/livekit-meeting-token-security-smoke.mjs`: **PASS**.
- Existing voice token security, LiveKit, and Edge release-scope smoke scripts: **PASS**.
- `npm run typecheck`: **PASS**.
- `npm run supabase:migrations:check`: **PASS** (171 ordered, BOM-free migrations).
- `npm run supabase:qa`: **PASS**.
- `npm run mock:smoke`: **PASS**.
- `npm run build`: **PASS**, with the pre-existing ineffective voice dynamic-import and large-chunk warnings.
- `npm run qa:smoke`: **FAILED OUTSIDE TASK SCOPE** at desktop-only smoke because concurrent user-owned `src/styles.css` contains a small `max-width` media-query pattern. Task 535 did not modify renderer UI/styles and did not alter or stage that work.
- `node scripts/livekit-meeting-token-staging-validation.mjs`: **BLOCKED SAFE DEFAULT**; no network request was made and no credential value was printed.
- Deno-native Edge typecheck: **BLOCKED** because Deno CLI is unavailable.
- Hosted Supabase actor matrix and real LiveKit token verification: **BLOCKED** until explicit staging fixtures/provider secrets are configured. No hosted pass is claimed.
- Renderer performance budget: not rerun because no renderer import graph or stylesheet changed.

## Security invariants

- LiveKit API secret stays in server secret storage and is never logged or returned.
- Waiting, blocked, unauthorized, over-capacity, invalid-session, and forbidden-source requests receive no token.
- A token contains only requested capabilities that server-side policy approved.
- No raw audio, camera, or screen media is recorded or persisted.
