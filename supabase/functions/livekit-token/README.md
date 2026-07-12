# Picom LiveKit Token Function

Authenticated Supabase Edge Function for short-lived, least-privilege Picom Voice Room and Screen Share tokens.

## Server-only configuration

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `PICOM_ALLOWED_ORIGINS`, comma-separated exact desktop/dev origins
- `PICOM_V1_VOICE_SCREEN_ENABLED`, explicit server-side release gate

Set these only with Supabase secret storage. Never use `VITE_` variables, renderer/preload values, logs, diagnostics, or committed files. Missing allowlist, missing credentials, invalid provider URL, or a release gate other than `true` fails closed.

## Authentication and identity

The Function verifies the Supabase JWT through the user-scoped client, then requires the canonical `profiles` row for the same `auth.uid()`. Profiles pending deletion and bot profiles are denied. The token participant identity is `auth.uid()`; the display name comes from canonical `profiles.display_name`, never renderer-provided auth metadata or custom text.

## Authorization

`POST` JSON accepts `communityId`, `channelId`, optional deterministic `roomName`, legacy/non-authoritative `participantName`, and `intent` (`voice` or `screen`). The Function validates JWT, V1 server gate, 2 KiB JSON contract, exact origin allowlist, per-user rate limit, canonical profile, community/channel existence, accepted membership, active ban/timeout state, and Voice channel type through `authorize_livekit_room`.

Every active community member receives ordinary Voice and Screen authorization without an Owner, Admin, Moderator, custom-role, private-channel, or channel-override grant. Visitors, non-members, removed members, deletion-pending profiles, bots, banned members, and timed-out members are denied. Moderation is a separate RPC and remains role-hierarchy controlled.

`voice` grants microphone publication. `screen` grants microphone, screen-share, and screen-share-audio sources. Both intents grant subscription. Camera and data publication are denied. Tokens expire after ten minutes.

## Protected staging deployment

The provider is the Picom-operated self-hosted LiveKit endpoint. LiveKit Cloud is not required. The protected wrapper `npm run livekit:token:self-hosted:deploy:staging -- --run` reads the API key/secret only from the root-owned host config outside the repository, derives the trusted `wss://` URL from protected network metadata, transfers values with a temporary `0600` Supabase CLI env file, and then invokes the existing hardened migration/function deployment plus hosted authorization/media fixtures.

The wrapper must not run until Tasks 660-663 have real staging host, trusted TLS/TURN, secret custody, and owner evidence. Dry-run mode performs no network request.

Use the manual `Picom LiveKit Token Staging` workflow with input `STAGING_ONLY`. The job runs only in the protected `hosted-staging` GitHub environment. It compares hosted migration history with the repository, applies and records pending migrations in order through the Supabase Management API, verifies the Task 660 authorization RPCs, deploys this Function, creates ephemeral synthetic fixtures, runs the hosted authorization matrix, removes all fixture data, and uploads a redacted evidence artifact. Existing schemas without migration history fail closed rather than replaying unknown DDL.

Local dry-run:

```powershell
npm run livekit:token:deploy:staging
npm run livekit:token:security:smoke
```

No local or workflow output may contain a PAT, service-role/secret key, provider key, JWT, fixture password, or synthetic email.
