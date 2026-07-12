# Picom V1 LiveKit Token Function

Status date: 2026-07-12  
Implementation status: **LOCAL SECURITY CONTRACT PASS / HOSTED DEPLOYMENT BLOCKED**

## Purpose

The `livekit-token` Supabase Edge Function is the sole V1 participant-token issuer for community Voice Rooms and Screen Share. Renderer components and Electron preload code never sign provider tokens.

## Implementation audit

- Client SDK: `livekit-client@2.20.0`.
- Server package: no `livekit-server-sdk` dependency is installed.
- Token signer: the existing Deno Web Crypto HMAC-SHA256 helper emits the minimal LiveKit JWT grant shape.
- Hosted provider acceptance remains required to prove compatibility; local shape checks are not a substitute.
- JWT verification: Supabase gateway `verify_jwt=true` plus `requireSupabaseUser`.
- Canonical identity: authenticated `auth.uid()` must map to an active, non-bot `profiles` row.
- Canonical name: `profiles.display_name`; renderer `participantName` is non-authoritative.
- Release state: `PICOM_V1_VOICE_SCREEN_ENABLED=true` is required server-side.
- Room authorization: `authorize_livekit_room` RPC.
- Token TTL: 600 seconds.
- Provider URL: `wss://` only, except `ws://localhost`/`127.0.0.1` for local development.
- CORS: exact configured origins; missing allowlist fails closed.
- Body: JSON only, supported keys only, 2 KiB maximum.
- Rate limit: `consume_current_user_action_rate_limit('livekit_token')`.
- Cache: `no-store`.
- Logs: the Function contains no token/secret logging.

## Grant contract

| Intent | Join | Subscribe | Microphone | Screen | Camera | Data |
| --- | --- | --- | --- | --- | --- | --- |
| Voice without speak permission | Yes | Yes | No | No | No | No |
| Voice with speak permission | Yes | Yes | Yes | No | No | No |
| Screen with share permission | Yes | Yes | Independently authorized | Yes | No | No |
| Visitor/banned/timed-out/private denial | No token | No token | No token | No token | No token | No token |
| V1 server gate disabled | 503, no token | - | - | - | - | - |

No V1 data-packet permission exists, so `canPublishData` remains false rather than granting an unused capability.

## Hosted test matrix

The staging validator is prepared to test:

- valid member Voice and Screen tokens;
- missing and expired JWT;
- visitor;
- unauthorized member;
- banned member;
- private channel;
- wrong HTTP method;
- malformed body;
- denied origin;
- canonical profile display name;
- 10-minute TTL;
- room/identity/source/data grants;
- absence of provider credential fields;
- separate V1-hidden mode.

Rate-limit exhaustion must be exercised in an approved isolated fixture because intentionally flooding a shared staging account is not safe.

## Deployment path

`npm run livekit:token:deploy:staging` is dry-run by default. `--apply` requires:

- Supabase CLI;
- `STAGING_ONLY` confirmation;
- exact approved project-reference match;
- reviewed migration confirmation;
- required protected secret names.

The Function remains excluded from `supabase/functions/release-manifest.json` until Task 654. The staging-only path cannot publish a V1 release.

## Hosted evidence

| Evidence | Result |
| --- | --- |
| Approved provider project | BLOCKED by Task 643 |
| Linked staging Supabase project | BLOCKED |
| Protected secret-name inventory | BLOCKED |
| Function deployment revision | BLOCKED |
| Allowed/denied hosted matrix | BLOCKED |
| Provider accepts generated token | BLOCKED |
| Hosted logs redaction review | BLOCKED |
| V1 hidden-state hosted probe | BLOCKED |

No deploy or network request was made in Task 644 because no approved project, provider, protected environment or credential custody exists.

## Release decision

The local implementation is safer and testable, but Task 644 does not meet its hosted acceptance criteria. Voice Rooms and Screen Share remain `HIDDEN_FROM_V1`.
