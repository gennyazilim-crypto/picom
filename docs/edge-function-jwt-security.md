# Edge Function JWT security

Task 202 centralizes Supabase JWT validation for protected Edge Functions.

## Shared helper

```text
supabase/functions/_shared/supabase-auth.ts
```

`requireSupabaseUser(request)`:

- Requires an `Authorization` header.
- Uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- Calls `supabase.auth.getUser()` with the caller's bearer token.
- Returns a verified user and Supabase client scoped to that user's JWT.
- Returns safe JSON errors for missing/invalid auth or missing Supabase config.

## Protected functions

These functions now use the shared helper:

- `livekit-token`
- `accept-invite`
- `moderation-helper`
- `notification-fanout`
- `validate-file`

`health` remains unauthenticated because it returns only non-sensitive health placeholder data.

## RLS implications

The shared helper uses the user's JWT, not a service-role key. Database queries made with the returned Supabase client still rely on RLS policies. This keeps row visibility, channel access, and membership checks inside Supabase policy boundaries.

## Required environment variables

Supabase Edge Functions provide or require:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

Privileged secrets such as `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` must stay in function secret storage only and must never be exposed to the Electron renderer.

## Manual test steps

When Supabase CLI is available:

1. Serve each protected function.
2. Call it with no `Authorization` header and confirm HTTP `401`.
3. Call it with an invalid bearer token and confirm HTTP `401`.
4. Call it with a valid Supabase user token and confirm the function reaches its normal placeholder or feature-specific response.
5. Confirm no function logs raw tokens, cookies, authorization headers, passwords, or secrets.
