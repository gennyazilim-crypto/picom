# Production Environment Freeze

Status date: 2026-07-10  
Freeze status: **Blocked / inventory locked, production values and owners not approved**

## Release identity

| Field | Current value | Stable requirement |
| --- | --- | --- |
| Package version | `0.1.1-beta.1` | Approved stable semver before artifact generation |
| Release channel example | `stable` | Must match package/build metadata |
| App ID | `com.picom.desktop` | Frozen |
| Product name | Picom | Frozen |
| Data source | Supabase in production example | Hosted validation required |

The current Windows artifact is beta-named and is not the stable frozen artifact.

## Renderer-safe public variables

- `VITE_APP_ENV`
- `VITE_RELEASE_CHANNEL`
- `VITE_APP_NAME`
- `VITE_APP_VERSION`
- `VITE_APP_IDENTIFIER`
- `VITE_DATA_SOURCE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Public OAuth/password-reset/email-verification redirect URLs and provider enable flags
- `VITE_LIVEKIT_ENABLED` and public `VITE_LIVEKIT_URL`
- Public status/remote-config URLs and realtime scaling mode

All `VITE_` values are bundled into the renderer and must never contain secrets.

## Server/CI-only variables

- Supabase project reference/access token and service-role key.
- LiveKit API key and secret.
- Database credentials.
- Windows signing material/password.
- Apple notarization/signing credentials and team identifiers.
- Provider/OAuth client secrets.

These belong in protected CI, Supabase/Edge secret storage, or an approved production secret manager. They must not appear in renderer env, logs, diagnostics, source control, or artifacts.

## Freeze checklist

| Item | Status |
| --- | --- |
| Env examples and placeholder/secret boundaries | Passed |
| No tracked real env files | Passed |
| Renderer service-role/LiveKit/signing secret scan | Passed |
| Staging admin bootstrap preflight safety | Passed with synthetic UUID; no network/SQL |
| Production Supabase URL/anon key | Not assigned/verified |
| Production Storage bucket/policies | Not hosted-verified |
| Edge Function deployment target and secrets | Not deployed/verified |
| LiveKit production URL/server secrets | Not assigned/verified |
| Allowed origins/CORS | Not approved/verified |
| Public status/support URLs | Not finalized |
| CI secret owners and access review | Owner placeholders remain |
| Stable package version/channel | Not frozen; current version is beta |

## Freeze rule

No stable artifact may be produced from handwritten local secret files. A release operator must fill renderer-safe values from the approved environment, inject server-only values through protected stores, run all environment/secret/hosted gates, and record owner/sign-off without committing values.

RB-09 remains open.

## Task 403 ownership update

Environment/placeholder/secret-boundary checks passed on 2026-07-10, but no named production owners or approved final values were supplied. `docs/production-ownership-matrix.md` therefore records every critical system as `UNASSIGNED`; the freeze remains incomplete under `docs/production-change-control.md`.
