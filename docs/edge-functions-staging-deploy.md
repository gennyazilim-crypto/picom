# Edge Functions staging deployment placeholder

Task 204 defines the staging deployment checklist for Picom Supabase Edge Functions.

This is a placeholder runbook. Do not deploy to production from these steps without a release approval, verified secrets, and a rollback owner.

## Scope

Functions covered:

- `health`
- `livekit-token`
- `accept-invite`
- `moderation-helper`
- `notification-fanout`
- `validate-file`

## Environment separation

| Environment | Purpose | Assumptions |
| --- | --- | --- |
| Local | Developer verification | Uses local Supabase CLI when available and placeholder secrets only. |
| Staging | Pre-release backend validation | Uses staging Supabase project, staging LiveKit project, and staging-only secrets. |
| Beta | Limited user validation | Uses beta-approved Supabase project or staging with explicit beta data policy. |
| Production | Stable release traffic | Requires final security, monitoring, rollback, and support readiness review. |

## Staging prerequisites

- Supabase CLI installed and authenticated.
- Staging Supabase project selected.
- Staging database migrations applied.
- Staging RLS policies verified.
- Function secrets set in Supabase secret storage, not committed files.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` configured only for `livekit-token`.
- `SUPABASE_SERVICE_ROLE_KEY` is not used unless a future task documents a specific privileged function need.

## Deployment commands placeholder

Use the staging project reference only:

```powershell
supabase link --project-ref STAGING_PROJECT_REF
supabase functions deploy health --no-verify-jwt
supabase functions deploy livekit-token
supabase functions deploy accept-invite
supabase functions deploy moderation-helper
supabase functions deploy notification-fanout
supabase functions deploy validate-file
```

Never paste real project refs, tokens, or secrets into documentation or commits.

## Verification checklist

- `health` returns a non-sensitive healthy response.
- Protected functions reject missing `Authorization` with `AUTH_REQUIRED`.
- Protected functions reject malformed bearer tokens with `AUTH_INVALID`.
- `livekit-token` returns a short-lived token only for an authenticated user with voice channel access.
- Placeholder functions return `501` with typed placeholder codes.
- `validate-file` accepts valid image metadata and rejects unsupported MIME/extension/size.
- Function logs do not contain auth headers, JWTs, passwords, LiveKit secrets, or service-role keys.

## Rollback

- Record the currently deployed function versions before deployment when the platform exposes version history.
- If a function fails staging verification, redeploy the last known-good function bundle.
- If rollback is not available, disable the feature at the caller level and document the failed function.
- Do not promote desktop builds that require a failed Edge Function.

## Known risks

- Supabase CLI may not be installed on every developer machine.
- Placeholder functions are intentionally not production behavior.
- CORS currently uses development-friendly defaults and needs a stable-release allowlist pass.
- LiveKit token validation depends on correct channel membership and RLS behavior.
- Staging data should not contain production user secrets or private production messages.

## Promotion gate

Before beta or production promotion:

- Re-run staging verification.
- Confirm function environment variables match `docs/edge-function-environment-variables.md`.
- Confirm renderer `.env` contains only `VITE_` safe values.
- Confirm rollback owner and communication path are known.
