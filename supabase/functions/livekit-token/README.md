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

`POST` JSON accepts `communityId`, `channelId`, optional deterministic `roomName`, legacy/non-authoritative `participantName`, and `intent` (`voice` or `screen`). The Function validates JWT, V1 server gate, 2 KiB JSON contract, exact origin allowlist, per-user rate limit, active profile, active community membership, bans/timeouts, voice channel, private access, and scoped `joinVoice`/`speakInVoice`/`shareScreen` permissions through `authorize_livekit_room`.

`voice` grants microphone publication only when allowed. `screen` grants screen-share sources only when allowed and preserves microphone publication only when independently authorized. Camera and data publication are denied. Tokens expire after ten minutes.

## Staging deployment

The V1 release manifest intentionally continues to exclude this Function until Task 654. Use the explicit staging-only path:

```powershell
npm run livekit:token:deploy:staging
$env:PICOM_CONFIRM_LIVEKIT_EDGE_DEPLOY="STAGING_ONLY"
$env:PICOM_CONFIRM_LIVEKIT_MIGRATIONS_APPLIED="YES"
npm run livekit:token:deploy:staging -- --apply
npm run livekit:token:staging -- --run
```

The apply command also requires the approved project-reference match and protected Supabase secret names. It never accepts or prints secret values. Production deployment is forbidden until the provider, hosted, security and Task 654 gates pass.
