# Secure LiveKit token Edge Function

## Security boundary

- Supabase gateway and `requireSupabaseUser` verify the bearer JWT.
- The user-scoped client calls `authorize_livekit_room`; renderer-supplied identity, grants, and arbitrary room names are never trusted.
- Only active members of active Text communities may join community voice channels.
- Visitors, banned users, active timeouts, inaccessible private channels, non-voice channels, and Radio/Podcast community kinds are denied.
- `joinVoice` controls room entry, `speakInVoice` controls microphone publish, and `shareScreen` controls screen publish.
- Tokens expire after ten minutes and never grant camera or LiveKit data publish.
- `LIVEKIT_API_SECRET` remains server-side and is excluded from renderer, preload, logs, and diagnostics.

## HTTP boundary

- `POST` and `OPTIONS` only.
- Exact `PICOM_ALLOWED_ORIGINS` allowlist with `Vary: Origin`; no credentialed wildcard.
- `application/json` only, maximum 2 KiB, supported keys only, bounded participant name.
- Responses use `Cache-Control: no-store` and never return server credentials.

## Staging matrix

Run `npm run livekit:token:security:smoke` locally. With approved staging configuration, run `node scripts/livekit-token-staging-validation.mjs --run` to verify missing JWT denial, permitted member success, visitor denial, private-channel denial, deterministic identity/room, ten-minute expiry, and publish-source grants. Values/tokens are never printed.

## Deployment status

Repository implementation and security contracts can pass locally. Actual `supabase db push`, secret configuration, function deployment, and LiveKit connection evidence remain `BLOCKED` until an approved staging project, Supabase CLI session, synthetic users/rooms, and LiveKit server credentials are available. A browser login alone is not evidence of deployment.
