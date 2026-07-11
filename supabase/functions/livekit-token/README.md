# Picom LiveKit Token Function

Authenticated Supabase Edge Function for short-lived, least-privilege Text-community voice-room tokens.

## Server-only configuration

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `PICOM_ALLOWED_ORIGINS`, comma-separated exact desktop/dev origins

Set these only with Supabase secret storage. Never use `VITE_` variables, renderer/preload values, logs, diagnostics, or committed files.

## Authorization

`POST` JSON accepts `communityId`, `channelId`, optional deterministic `roomName`, optional safe `participantName`, and `intent` (`voice` or `screen`). The function verifies the Supabase JWT, rate limit, 2 KiB JSON contract, origin allowlist, active Text community, active membership, bans/timeouts, voice channel, private access, and scoped `joinVoice`/`speakInVoice`/`shareScreen` permissions through `authorize_livekit_room`.

Tokens expire after ten minutes. Voice tokens publish microphone only when `speakInVoice` is allowed. Screen tokens publish screen-share sources only when `shareScreen` is allowed. Camera and data publishing are not granted.

## Deployment

```powershell
supabase link --project-ref <staging-project-ref>
supabase db push
supabase secrets set LIVEKIT_URL=<wss-url> LIVEKIT_API_KEY=<server-key> LIVEKIT_API_SECRET=<server-secret> PICOM_ALLOWED_ORIGINS=<exact-origins>
supabase functions deploy livekit-token
node scripts/livekit-token-staging-validation.mjs --run
```

Use synthetic staging users/rooms. Do not print tokens or secret values. Production deployment requires separate approval.
