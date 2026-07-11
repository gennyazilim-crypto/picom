# Supabase Edge Functions Release Scope

The authoritative function inventory is `supabase/functions/release-manifest.json`.

## Classification

- Public release: health/readiness and sanitized client config.
- Authenticated release: LiveKit token/moderation, metadata-only file validation, own-data export, and account-deletion request/cancel.
- Internal release: account-deletion finalizer, disabled by default and protected by a constant-time worker-secret check.
- Placeholder exclusion: invite acceptance, moderation helper, and notification fanout. Full MVP uses database/RLS paths where available; no 501 function is treated as deployed evidence.
- Post-release exclusion: webhook message delivery.

## Security contract

Gateway `verify_jwt` is explicit for every deployed function. Authenticated handlers independently resolve the current Supabase user. Shared CORS rejects unlisted browser origins via `PICOM_ALLOWED_ORIGINS`; native calls without `Origin` remain supported. No credentialed wildcard CORS is enabled.

Bounded JSON validation checks content type, declared and actual byte length, object shape, and allowlisted keys. LiveKit provider credentials, service-role keys, and worker secrets are read only from Supabase secret storage and are never returned or logged.

## Staging deployment

Dry-run is safe and makes no network change:

```powershell
node scripts/deploy-release-edge-functions.mjs
```

Apply requires the Supabase CLI, an authenticated operator environment, an exact approved staging project match, and secret-name inventory:

```powershell
$env:SUPABASE_PROJECT_REF='<staging-ref>'
$env:PICOM_EDGE_STAGING_PROJECT_REF='<staging-ref>'
$env:PICOM_CONFIRM_EDGE_DEPLOY='STAGING_ONLY'
node scripts/deploy-release-edge-functions.mjs --apply
```

Never place secret values in command arguments, `.env` artifacts, logs, or renderer variables. Production deployment requires a separate release approval.

## Hosted validation

`node scripts/hosted-staging-edge-functions-validation.mjs --run` verifies public allowed/denied origins, protected missing/invalid JWT denial, methods, a safe file-validation success, and a short-lived LiveKit token without printing it. It intentionally does not execute an account-deletion success path or other destructive workflows.
