# Edge Functions and Supabase service boundaries

Task 195 defines Picom's trusted Supabase Edge Function boundary for the Electron desktop MVP.

## Boundary rule

The Electron renderer is an untrusted client. It may use only renderer-safe values:

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The renderer must never receive:

- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_API_SECRET`
- signing keys
- database passwords
- auth tokens from another user

The broader Supabase microservice boundary policy is documented in `docs/supabase-microservice-boundaries.md`.

## Direct Supabase client flows

Use direct Supabase Auth/Postgres/Storage/Realtime from the renderer only when RLS and Storage policies enforce the rule:

- login/register/logout/session restore
- current user's profile read/update
- visible community/channel/member reads
- message fetch/send/edit/delete where policies allow it
- reaction create/delete where policies allow it
- attachment upload metadata and Storage object access where policies allow it
- realtime subscriptions to RLS-protected tables

## Edge Function flows

Use Edge Functions for trusted or privileged work:

- `livekit-token`: creates short-lived LiveKit room tokens with server-only LiveKit secrets.
- `accept-invite`: validates invite state and creates membership atomically.
- `moderation-helper`: placeholder for privileged moderation decisions.
- `notification-fanout`: placeholder for server-side notification routing.
- `validate-file`: validates upload metadata without exposing privileged configuration.
- `health`: public non-sensitive health check.

## Shared function modules

```text
supabase/functions/_shared/
  auth.ts
  cors.ts
  errors.ts
  http.ts
  supabase-auth.ts
  livekit-token.ts
  file-validation.ts
```

- `cors.ts` owns preflight headers. Production should replace wildcard origins with an explicit allowlist before stable release.
- `errors.ts` defines typed error bodies.
- `http.ts` returns JSON responses and typed error responses.
- `auth.ts` is the stable shared auth import path for functions.
- `supabase-auth.ts` verifies the signed-in Supabase user from the Authorization header.
- `livekit-token.ts` signs LiveKit grants inside the trusted server boundary.

## Security expectations

- Protected functions require an `Authorization` header.
- Protected functions require `Authorization: Bearer <user-jwt>`.
- Protected functions verify Supabase JWT before reading user-specific data.
- Public health functions are the only functions that should use `verify_jwt = false`.
- Functions should import auth from `_shared/auth.ts` rather than directly from `_shared/supabase-auth.ts`.
- Service-role access is allowed only inside trusted functions and only when RLS-safe client access is not enough.
- Request bodies must be validated before use.
- Responses should use `{ code, message, details? }` for errors.
- Do not log authorization headers, JWTs, passwords, service-role keys, or LiveKit secrets.

## Environment variables

Function-specific environment variables are documented in `docs/edge-function-environment-variables.md`.

- Renderer-safe values use `VITE_` prefixes and may be bundled into the Electron renderer.
- Edge Function secrets do not use `VITE_` and must stay in Supabase secret storage or local function-only `.env` files.
- Add a variable to the function matrix before making a function depend on it.

## Staging deployment

Staging deployment assumptions, verification steps, and rollback notes are documented in `docs/edge-functions-staging-deploy.md`.

## Local testing

Local Supabase CLI invocation and expected auth/error checks are documented in `docs/edge-functions-local-test-guide.md`.

## Local invocation

When the Supabase CLI is available:

```powershell
supabase functions serve health --no-verify-jwt
supabase functions serve livekit-token
supabase functions serve accept-invite
supabase functions serve moderation-helper
supabase functions serve notification-fanout
supabase functions serve validate-file
```

Example protected invocation:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:54321/functions/v1/livekit-token" `
  -Headers @{ Authorization = "Bearer <user-jwt>" } `
  -ContentType "application/json" `
  -Body '{"communityId":"<uuid>","channelId":"<uuid>","intent":"voice"}'
```

Use a real user JWT from Supabase Auth. Do not use service-role keys for renderer tests.
