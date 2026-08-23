# PICOM auth production E2E closure

Timestamp: 2026-08-23T2158Z
Project: `cqnsetsmcduraryemhbi`
Public IP unchanged: `23.254.166.240`
VPS networking was not modified. VPS was not rebooted.

## Operator gate

```text
Required phrase: APPROVE_PRODUCTION_E2E_IDENTITY_PROVISIONING
Present in operator message: NO
Present in process env: NO
PICOM_PROD_E2E_EMAIL_A: unset
1Password MCP: unavailable
```

```text
PRODUCTION E2E IDENTITY PROVISIONING:
BLOCKED_OPERATOR_APPROVAL
TEST_IDENTITY_A: BLOCKED
TEST_IDENTITY_B: BLOCKED
```

No production user was created. No customer account was used.

## Google (hosted probe, no secrets printed)

Canonical source redirect:

```text
https://auth.picom.gg/google/callback?state=<32-128 URL-safe>
```

Live `GET /auth/v1/authorize?provider=google` on production (five redirect_to values including canonical, account callback, `picom://auth/callback`, and a rejected host):

```text
HTTP 400
error_code=validation_failed
msg=Unsupported provider: provider is not enabled
```

Management API auth-config read: no local `SUPABASE_ACCESS_TOKEN`.
Google Cloud Console: not operator-accessible this session.
Packaged flag `VITE_SUPABASE_GOOGLE_OAUTH_ENABLED=false`.

```text
GOOGLE:
BLOCKED_EXTERNAL_CONFIGURATION — production Supabase Google provider is not enabled; Google Cloud client id/secret/redirect unverified
```

## Epic

Canonical source redirect: `https://auth.picom.gg/epic/callback`

Production Edge secrets still missing `EPIC_CLIENT_ID`, `EPIC_CLIENT_SECRET`, `EPIC_DEPLOYMENT_ID`.
`epic-auth` was not deployed (would be an incomplete function).

```text
EPIC:
BLOCKED_EXTERNAL_CONFIGURATION — EPIC_CLIENT_ID, EPIC_CLIENT_SECRET, EPIC_DEPLOYMENT_ID
```

## Steam

Identity path is OpenID `check_authentication` + 17-digit SteamID64 from `openid.claimed_id`.
`STEAM_WEB_API_KEY` is used only in `fetchSteamProfile` and falls back to `Steam <last4>` when absent.

```text
STEAM_WEB_API_PROFILE_ENRICHMENT: OPTIONAL_BLOCKED
STEAM E2E: BLOCKED_OPERATOR_APPROVAL
```

## Account classification

```text
ACCOUNT.PICOM.GG NETWORK/TLS: PASS
ACCOUNT WORKFLOW E2E: BLOCKED_OPERATOR_APPROVAL
```

## Security

`document.cookie =` in `MarketingConsentBoundary.tsx` is a consent preference write, not a secret.
`scripts/secret-exposure-smoke-test.mjs` now excludes `document.cookie` and still fails `COOKIE=`, `SESSION_COOKIE=`, `AUTH_COOKIE=`, `COOKIE_SECRET=`, `COOKIE_KEY=`, `SECURE_COOKIE=`.

```text
SECRETS_SMOKE: PASS
I18N catalog integrity: PASS
electron:security:smoke: PASS
```

Aikido on the smoke-test edit: remaining path-traversal finding is the local `src`/`electron` walk (no attacker-controlled path). Generic-key finding on the consent fixture was removed.
