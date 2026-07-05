# Edge Functions local test guide

Task 205 documents safe local verification for Picom Supabase Edge Functions.

Use this guide for local development only. Do not paste real production secrets, real user tokens, or service-role keys into docs, commits, screenshots, or chat.

## Prerequisites

- Supabase CLI installed.
- Docker Desktop or compatible local container runtime running.
- Picom repository dependencies installed.
- Local Supabase project started with `supabase start`.
- A local test user created through Supabase Auth or the Picom app.

If the Supabase CLI is missing, the repository smoke test still reports schema/documentation presence, but function invocation must be tested manually after installing the CLI.

## Start local Supabase

```powershell
supabase start
```

Optional schema smoke test from the repository:

```powershell
npm run supabase:smoke
```

## Serve functions locally

Public health function:

```powershell
supabase functions serve health --no-verify-jwt
```

Protected functions:

```powershell
supabase functions serve livekit-token
supabase functions serve accept-invite
supabase functions serve moderation-helper
supabase functions serve notification-fanout
supabase functions serve validate-file
```

## Get a local user JWT

Use a local development user only. Do not use production accounts.

```powershell
$auth = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:54321/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = "LOCAL_SUPABASE_ANON_KEY" } `
  -ContentType "application/json" `
  -Body '{"email":"owner@picom.local","password":"LOCAL_DEV_PASSWORD"}'

$token = $auth.access_token
```

Replace placeholders with local values from `supabase status` or local seed credentials. Never commit these values.

## Expected auth checks

Missing header:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:54321/functions/v1/validate-file" `
  -ContentType "application/json" `
  -Body '{"fileName":"picom.png","mimeType":"image/png","sizeBytes":12345}'
```

Expected: HTTP `401` with `AUTH_REQUIRED`.

Malformed header:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:54321/functions/v1/validate-file" `
  -Headers @{ Authorization = "not-a-bearer-token" } `
  -ContentType "application/json" `
  -Body '{"fileName":"picom.png","mimeType":"image/png","sizeBytes":12345}'
```

Expected: HTTP `401` with `AUTH_INVALID`.

## Function checks

Validate file:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:54321/functions/v1/validate-file" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"fileName":"picom.png","mimeType":"image/png","sizeBytes":12345}'
```

Expected: `valid: true` and a sanitized file name.

Placeholder functions:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:54321/functions/v1/notification-fanout" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"eventType":"message_mention"}'
```

Expected for placeholders: HTTP `501` with a typed `*_NOT_IMPLEMENTED` code.

LiveKit token:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:54321/functions/v1/livekit-token" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"communityId":"LOCAL_COMMUNITY_UUID","channelId":"LOCAL_VOICE_CHANNEL_UUID","intent":"voice"}'
```

Expected: token response only when local LiveKit secrets are configured and the user can access the voice channel.

## Safety checklist

- Use local anon key only for local tests.
- Never call protected functions with service-role keys from the renderer.
- Never commit local JWTs, project refs, LiveKit secrets, or Supabase service-role keys.
- Confirm placeholder functions return explicit placeholder errors instead of fake success.
- Confirm function logs do not include authorization headers or raw tokens.
