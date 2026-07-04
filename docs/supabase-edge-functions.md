# Supabase Edge Functions project structure

Task 196 creates the first Picom Edge Functions structure without adding secrets or production-only dependencies.

## Directory layout

```text
supabase/functions/
  README.md
  _shared/
    cors.ts
    http.ts
  health/
    index.ts
```

## Current function

`health` is a safe placeholder function used to validate that the Edge Functions folder structure is ready.

- It does not use service-role credentials.
- It does not read secrets.
- It returns a minimal JSON health payload.
- It allows unauthenticated checks through local Supabase config.

## Supabase config

`supabase/config.toml` includes:

```toml
[functions.health]
verify_jwt = false
```

This is intentional for the non-sensitive placeholder health function. Privileged functions should keep JWT verification enabled unless a later task documents and justifies otherwise.

## Security notes

- The Electron renderer must never receive `SUPABASE_SERVICE_ROLE_KEY`.
- Future privileged functions should read secrets only from Supabase function secret storage.
- Shared helpers must not log tokens, passwords, cookies, authorization headers, or provider secrets.
- Edge Functions are not a substitute for RLS on normal client-visible data.

## Manual verification

When Supabase CLI is available:

```powershell
supabase functions serve health --no-verify-jwt
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/health
```

Expected response:

```json
{
  "ok": true,
  "service": "picom-edge-functions",
  "function": "health"
}
```
