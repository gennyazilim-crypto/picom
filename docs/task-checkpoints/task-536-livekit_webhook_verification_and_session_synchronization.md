# Task 536 checkpoint: LiveKit webhook verification and session synchronization

## Delivered

- Raw-body LiveKit HS256 JWT, issuer/time, and standard-Base64 SHA-256 verification matching the official receiver contract.
- Provider-signed `livekit-webhook` Edge Function with method/content-type/body-size validation and service-role-only persistence.
- Replay-safe receipt ledger, duplicate no-op behavior, digest mismatch rejection, redacted retry/dead-letter state, and canonical room parsing.
- Authoritative room/session, participant, track metadata, participant count, event sequence, and attendance reconciliation.
- Room started/finished, participant joined/left/connection-aborted, and track published/unpublished handling; egress/ingress events are verified then intentionally ignored because recording/streaming is out of scope.
- Release config/manifest registration, generated DB types, structural SQL contract, security smoke, staging matrix, and operator runbook.

## Validation status

- `node scripts/livekit-webhook-security-smoke.mjs`: **PASS**.
- Existing Edge release-scope and LiveKit smoke scripts: **PASS**.
- `npm run typecheck`: **PASS**.
- `npm run supabase:migrations:check`: **PASS** (172 ordered, BOM-free migrations).
- `npm run supabase:qa`: **PASS**.
- `npm run mock:smoke`: **PASS**.
- `npm run build`: **PASS**, with the pre-existing ineffective voice dynamic-import and large-chunk warnings.
- `npm run qa:smoke`: **FAILED OUTSIDE TASK SCOPE** at desktop-only smoke because concurrent user-owned `src/styles.css` contains a small `max-width` media-query pattern. Task 536 did not modify renderer UI/styles and did not alter or stage that work.
- `node scripts/livekit-webhook-staging-validation.mjs`: **BLOCKED SAFE DEFAULT**; no network request was made and no credential/token/secret was printed.
- Deno-native typecheck, deployed signature validation, SQL actor test, and hosted session reconciliation: **BLOCKED** while Deno/Supabase CLI and provider staging fixtures are unavailable. No provider evidence is fabricated.
- Renderer performance budget: not rerun because no renderer import graph or stylesheet changed.

## Security invariants

- Invalid signature, expired token, issuer mismatch, or body-hash mismatch is rejected before JSON processing.
- Raw body, Authorization JWT, API secret, service-role key, and media are never persisted or logged.
- Only `service_role` may execute provider reconciliation; authenticated clients cannot finalize attendance.
- Duplicate events cannot increment attendance, participant count, or session sequence twice.
