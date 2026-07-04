# Picom Supabase Edge Functions

This directory contains Supabase Edge Function code for trusted server-side MVP workflows.

## Rules

- Do not place service-role keys or provider secrets in source control.
- Store secrets in Supabase function secret storage.
- Keep renderer-safe workflows in the normal Supabase client plus RLS.
- Use Edge Functions only for privileged or server-only workflows.

## Current structure

- `_shared/` - reusable HTTP/CORS helpers.
- `health/` - safe unauthenticated placeholder function for local structure checks.

## Local invocation placeholder

When Supabase CLI is available:

```powershell
supabase functions serve health --no-verify-jwt
```

Then call:

```powershell
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/health
```
