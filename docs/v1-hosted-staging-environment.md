# Picom V1 Hosted Staging Environment

Status date: 2026-07-12  
Result: **HOSTED ENVIRONMENT CONFIGURED / LOCAL CLI AUTH VERIFICATION BLOCKED**

This record contains names and public endpoints only. No access token, provider secret, password, participant JWT, or service-role credential is included.

## Real environment inventory

| Boundary | Configuration | Result |
| --- | --- | --- |
| Supabase project | `picom-staging`; project ref `ufmtvqtsklqsmqxefbbs` | PASS_REAL |
| Supabase public URL | `https://ufmtvqtsklqsmqxefbbs.supabase.co` | PASS_REAL |
| LiveKit project | `Picom Staging` | PASS_REAL |
| LiveKit WSS | `wss://picom-blmsm07k.livekit.cloud` | PASS_REAL |
| GitHub environment | `hosted-staging` | PASS_REAL |
| Deployment branches | selected branch rule: `main` only | PASS_REAL |
| Required reviewer | `gennyazilim-crypto` | PASS_REAL |
| Self-review | prevented | PASS_REAL |
| Administrator bypass | disabled | PASS_REAL |

## Supabase Edge Function secrets

Names verified in the `picom-staging` Edge Function secret table:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `PICOM_ALLOWED_ORIGINS`
- `PICOM_V1_VOICE_SCREEN_ENABLED`

The values were transferred from the newly generated `Picom Staging` LiveKit credential directly in authenticated browser memory. Values were not printed, copied into repository files, emitted in documentation, or exposed to renderer configuration.

Staging allowlist includes the local Vite origins used by the desktop development flow and the Electron opaque-origin fallback. Authentication, active membership, room validation, rate limits, and token scoping remain mandatory even when CORS permits the origin.

## GitHub protected environment

Environment secret names configured:

- `SUPABASE_ACCESS_TOKEN` (30-day operator token; rotate before expiry)
- `PICOM_RLS_STAGING_URL`
- `PICOM_RLS_STAGING_ANON_KEY` (publishable client key, stored as a secret because current workflows consume the secret context)

Environment variable names configured:

- `SUPABASE_PROJECT_REF`
- public staging renderer/Edge variables were submitted in the browser session; their final name inventory must be rechecked before a staging package workflow consumes them.

The LiveKit API secret is intentionally not stored in GitHub. It remains only in Supabase Edge Function secrets.

## Repository link state

The safe project-ref marker exists at `supabase/.temp/project-ref` in the operator checkout and the task worktree. The `hosted-staging` environment also carries `SUPABASE_PROJECT_REF` and a protected CLI token.

A local `npx supabase link` attempt did not authenticate because Chrome and PowerShell use isolated clipboard stores. The token was never placed on a command line or in a file. Therefore the authenticated local CLI link is **BLOCKED**, while the dashboard and protected GitHub deployment path are configured. Task 661 must deploy through the protected environment or an authenticated local CLI session and record the deployed revision.

## Renderer-safe staging contract

`.env.staging.example` contains:

- `VITE_DATA_SOURCE=supabase`
- `VITE_RELEASE_CHANNEL=beta`
- public Supabase URL
- blank publishable-key placeholder
- `VITE_LIVEKIT_ENABLED=true`
- public LiveKit WSS URL

It contains no server secret. `.env.staging.example` is not loaded by normal Vite production builds. `.env.production.example` contains no staging project ref, endpoint, or environment name.

## Environment separation

- Staging and production use different LiveKit projects, endpoints, and keys.
- The Supabase project is staging-only.
- Production artifacts do not consume `hosted-staging` unless a workflow explicitly requests that protected environment.
- Ordinary QA has no access to provider or deployment credentials.
- Hosted workflow execution still requires `STAGING_ONLY`.
- Synthetic account secrets and fixture IDs remain Task 665 work.

## Remaining work

- Deploy Task 661 token function and Task 660 migration through the protected staging environment.
- Recheck any public `VITE_*` environment variables whose batch browser save was interrupted.
- Add synthetic member/visitor/blocked test accounts and fixture IDs.
- Rotate the 30-day Supabase access token before expiry.
- Complete hosted two-client and packaged Windows evidence.