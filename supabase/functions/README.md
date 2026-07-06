# Picom Supabase Edge Functions

This directory contains Supabase Edge Function code for trusted server-side MVP workflows.

## Rules

- Do not place service-role keys or provider secrets in source control.
- Store secrets in Supabase function secret storage.
- Keep renderer-safe workflows in the normal Supabase client plus RLS.
- Use Edge Functions only for privileged or server-only workflows.

## Current structure

- `_shared/` - reusable auth, HTTP, typed error, CORS, LiveKit, and validation helpers.
- `health/` - safe unauthenticated health, liveness, and readiness function for local structure checks.
- `livekit-token/` - protected LiveKit token function; secrets stay server-side.
- `accept-invite/` - protected invite acceptance boundary.
- `moderation-helper/` - protected moderation placeholder boundary.
- `notification-fanout/` - protected notification fanout placeholder boundary.
- `validate-file/` - protected upload validation boundary.

## Local invocation placeholder

When Supabase CLI is available:

```powershell
supabase functions serve health --no-verify-jwt
supabase functions serve livekit-token
```

Then call:

```powershell
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/health
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/health/live
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/health/ready
```
