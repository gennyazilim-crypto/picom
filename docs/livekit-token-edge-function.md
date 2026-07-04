# LiveKit token Edge Function

Task 197 adds the Supabase Edge Function boundary for Picom voice tokens.

## Function

```text
supabase/functions/livekit-token/index.ts
```

The function accepts:

```json
{
  "communityId": "uuid",
  "channelId": "uuid"
}
```

It returns:

```json
{
  "token": "livekit-jwt",
  "url": "livekit-server-url",
  "roomName": "picom:communityId:channelId",
  "identity": "supabase-user-id",
  "expiresAt": "iso-date"
}
```

## Security model

- The renderer sends the user's Supabase Auth bearer token.
- The Edge Function validates the session with Supabase Auth.
- The function queries `public.channels` using the user's JWT, so channel access remains governed by RLS.
- The channel must be a `voice` channel.
- LiveKit API key/secret stay in Edge Function environment variables only.
- The token is scoped to one room and one user identity.

## Required environment variables

Supabase provides:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

Set these in Supabase function secret storage:

```env
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Do not commit real LiveKit values.

## Supabase configuration

`supabase/config.toml` includes:

```toml
[functions.livekit-token]
verify_jwt = true
```

## Local test placeholder

When Supabase CLI and LiveKit credentials are available:

```powershell
supabase functions serve livekit-token
```

Then call with a valid Supabase user access token:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:54321/functions/v1/livekit-token `
  -Headers @{ Authorization = "Bearer USER_ACCESS_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"communityId":"COMMUNITY_UUID","channelId":"VOICE_CHANNEL_UUID"}'
```

## Platform notes

- Windows: microphone access depends on Windows privacy settings and Chromium permission prompts.
- Linux: microphone and screen sharing may depend on PulseAudio/PipeWire and xdg-desktop-portal support.
- macOS: microphone and screen recording require System Settings permissions.

## Current limitation

This task creates the token boundary only. The renderer voice connection UI/service can call this function in later voice tasks.
