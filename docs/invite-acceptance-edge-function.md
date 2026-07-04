# Invite acceptance Edge Function placeholder

Task 198 prepares the Edge Function boundary for future invite acceptance.

## Function

```text
supabase/functions/accept-invite/index.ts
```

Request:

```json
{
  "code": "INVITE_CODE"
}
```

Current response:

```json
{
  "code": "INVITE_ACCEPTANCE_NOT_IMPLEMENTED",
  "message": "Invite acceptance is prepared but not enabled yet.",
  "accepted": false
}
```

## Why placeholder only

The current schema does not yet include an `invites` table or atomic invite acceptance procedure. Returning success would create misleading UI behavior and could hide future membership/security bugs.

## Security model

- JWT verification is enabled for the function.
- The function requires an `Authorization` header.
- Invite codes are validated before any future database lookup.
- No service-role key is used in the placeholder.
- Future implementation should perform invite lookup, expiration checks, use-count updates, and member creation atomically.

## Supabase configuration

```toml
[functions.accept-invite]
verify_jwt = true
```

## Future implementation checklist

- Add an `invites` table with hard-to-guess codes or token hashes.
- Add expiration and revoked state.
- Add max-use and current-use tracking.
- Add an atomic SQL RPC or transaction-like Edge Function flow.
- Create membership inside the trusted boundary only after validation.
- Return a safe community/channel destination for deep-link routing.

## Manual verification

When Supabase CLI is available:

```powershell
supabase functions serve accept-invite
```

Call with a valid Supabase user token:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:54321/functions/v1/accept-invite `
  -Headers @{ Authorization = "Bearer USER_ACCESS_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"code":"picom-test"}'
```

Expected for now: HTTP `501` with `INVITE_ACCEPTANCE_NOT_IMPLEMENTED`.
