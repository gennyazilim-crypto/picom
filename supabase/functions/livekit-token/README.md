# Picom LiveKit Token Function

This authenticated Supabase Edge Function issues short-lived LiveKit room tokens for Picom voice channels.

## Server-only secrets

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Set them with `supabase secrets set`. Never expose the API key/secret through `VITE_` variables, Electron preload, renderer code, logs, diagnostics, or committed files.

## Request

`POST /functions/v1/livekit-token` with the signed-in user's Supabase access token and JSON:

```json
{
  "communityId": "uuid",
  "channelId": "uuid",
  "participantName": "Optional display name",
  "intent": "voice"
}
```

`intent` may be `voice` or `screen`. The function verifies the Supabase user, validates the UUIDs, reads the voice channel through RLS, derives `community:<communityId>:voice:<channelId>`, and uses `auth.uid()` as participant identity.

## Token boundary

The token expires after one hour and grants room join, subscribe, publish, and data publish capabilities. Current MVP publishing supports microphone audio and screen-share tracks. If future policy requires per-source grants, tighten the server grant before exposing new UI.

Expected grant review:

- `roomJoin: true`
- `room` exactly matches the server-derived community/channel room
- `canSubscribe: true`
- `canPublish: true` for microphone and screen-share tracks
- `canPublishData: true` for bounded room-control/presence data

The renderer cannot select an arbitrary identity or room name. Participant identity is the authenticated Supabase user ID.

## Deploy

```powershell
supabase secrets set LIVEKIT_URL=<wss-url>
supabase secrets set LIVEKIT_API_KEY=<server-key>
supabase secrets set LIVEKIT_API_SECRET=<server-secret>
supabase functions deploy livekit-token
```

Unauthenticated requests and users who cannot read the target voice channel must be rejected.
