# Picom V1 LiveKit Token Function

Status date: 2026-07-12

## Purpose

`livekit-token` is the sole V1 participant-token issuer for community Voice Rooms and Screen Share. Renderer components and Electron preload code never sign provider tokens and never receive provider credentials.

## Security contract

- Supabase gateway JWT verification plus `requireSupabaseUser`.
- Canonical `auth.uid()` identity and `profiles.display_name` participant label.
- Deletion-pending and bot profiles denied.
- `PICOM_V1_VOICE_SCREEN_ENABLED=true` required server-side.
- `authorize_livekit_room` is the server authorization boundary.
- Active membership, community/channel ownership, Voice type, archived state, ban, and timeout checks are server-side.
- Role, role position, custom role, private-channel permission, and channel overrides do not restrict ordinary member Voice or Screen access.
- Moderation remains separate and role-hierarchy controlled.
- Exact CORS allowlist, JSON-only 2 KiB body, supported keys only, deterministic room naming, 600-second TTL, and no-store response.
- Per-user `livekit_token` rate limit is 10 requests per 60 seconds.
- No Function code logs token, credential, microphone content, or shared-screen content.

## Grant contract

| Caller / intent | Join | Subscribe | Microphone | Screen | Screen audio | Camera | Data |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active member / Voice | Yes | Yes | Yes | No | No | No | No |
| Active member / Screen | Yes | Yes | Yes | Yes | Yes | No | No |
| Active roleless member | Same member grants | Same member grants | Same member grants | Same member grants | Same member grants | No | No |
| Visitor / non-member / removed / banned / timed out | No token | No token | No token | No token | No token | No token | No token |
| V1 server gate disabled | 503, no token | - | - | - | - | - | - |

## Protected hosted workflow

`.github/workflows/livekit-token-staging.yml` is manual-only and requires `STAGING_ONLY`. The `hosted-staging` environment supplies the Supabase PAT and approved project reference. The workflow:

1. runs the source security contract;
2. applies and records migration `20260712166000` through the official Supabase Management API database query endpoint;
3. verifies the member and token RPCs;
4. deploys `livekit-token` with Supabase CLI `2.109.1`;
5. creates temporary confirmed Auth identities and a private fixture community;
6. proves Owner, Admin, Moderator, Member, and roleless Member Voice/Screen/private-Voice grants;
7. proves Visitor, non-member, and banned denial;
8. proves JWT, CORS, method, body, camera/data, and 10-per-minute rate-limit behavior;
9. removes the fixture community and users;
10. uploads only a redacted JSON result artifact.

The workflow never prints or uploads the PAT, Supabase server key, LiveKit secret, generated JWT, fixture password, email, or raw user/community/channel identifier.

## Evidence boundary

The committed evidence contract is `docs/evidence/task-661-livekit-token-hosted-evidence-contract.json`. The real run produces artifact `task-661-livekit-token-staging-evidence` containing `task-661-livekit-token-staging.json`. A green source commit alone is not hosted proof; the protected workflow run and artifact are mandatory.

Provider connection and two-client native media evidence remain separate Tasks 663-668. Task 661 proves the deployed issuer and grant/denial contract without claiming native microphone or screen-capture success.
