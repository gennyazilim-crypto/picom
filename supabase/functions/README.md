# Picom Supabase Edge Functions

This directory contains Supabase Edge Function code for trusted server-side MVP workflows.

## Rules

- Do not place service-role keys or provider secrets in source control.
- Store secrets in Supabase function secret storage.
- Keep renderer-safe workflows in the normal Supabase client plus RLS.
- Use Edge Functions only for privileged or server-only workflows.

## Release inventory

- `_shared/` - reusable auth, HTTP, typed error, CORS, LiveKit, and validation helpers.
- Public release: `health`, `client-config`.
- Authenticated release: `livekit-token`, `livekit-moderation`, `validate-file`, `user-data-export`, `account-deletion`.
- Internal release worker: `account-deletion-finalize`, disabled by default and guarded by a separate worker secret.
- Excluded placeholders: `accept-invite`, `moderation-helper`, `notification-fanout`.
- Post-release: `webhook-message`.

`release-manifest.json` is authoritative. Placeholder/post-release functions must not be included in the Full MVP deploy command.

## Local invocation

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

All browser-origin requests require an exact `PICOM_ALLOWED_ORIGINS` match. Native requests without an `Origin` header remain supported. Authenticated functions also require a valid Supabase bearer JWT; request bodies are MIME-checked and bounded where applicable.
