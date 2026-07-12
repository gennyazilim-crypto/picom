# Task 644 Checkpoint: Secure LiveKit Token Edge Function Deployment

## Result

**LOCAL IMPLEMENTATION PASS / HOSTED DEPLOYMENT BLOCKED**

## Changes

- Added a fail-closed server-side V1 Voice/Screen release gate.
- Required canonical active human profile identity and display name.
- Rejected deletion-pending and bot profiles.
- Required exact configured CORS origins with no implicit production localhost fallback.
- Validated provider URL as secure `wss://` (local loopback exception only).
- Preserved 600-second, room-scoped, source-limited grants with camera/data denied.
- Added explicit staging-only deploy tooling.
- Expanded hosted validation for member, screen, visitor, unauthorized, banned, private, JWT, CORS, method and body cases.
- Added manual hosted workflow wiring.
- Kept the Function excluded from the V1 release manifest until Task 654.

## Provider/dashboard configuration

None. Task 643 provider/project/custody prerequisites remain unavailable. No secret value was read or printed.

## Tests planned/executed

Local structural/security tests are executed after this change. Hosted deploy and network tests are blocked because the approved environment does not exist.

## Redacted evidence

- `docs/v1-livekit-token-function.md`
- `scripts/livekit-token-security-smoke.mjs`
- `scripts/livekit-token-staging-validation.mjs`
- `scripts/deploy-livekit-token-staging.mjs`

## Remaining blockers

- Real provider and project.
- Protected staging Supabase environment and secrets.
- Migration deployment evidence.
- Hosted Function revision.
- Full hosted negative/positive token matrix.
- Hosted provider token acceptance and log review.
- Tasks 645-653 and Task 654 reclassification.
