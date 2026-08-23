# PICOM Authentication V2 final report

Audit date: 2026-08-23  
Verdict: **NOT PRODUCTION READY** — `auth.picom.gg/health` is live, but hosted Google/Epic/Steam credentials and Supabase redirect allowlists are unverified, the Google redirect URI is missing from local/runtime configuration, and real packaged Windows provider E2E was not executed.

This rebuild extends the existing PICOM auth stack. It does not add a second identity system, a second JWT, or `api.picom.gg`.

## Canonical architecture

### GOOGLE

```text
PICOM Desktop
→ Google / Supabase PKCE (signInWithOAuth, skipBrowserRedirect)
→ auth.picom.gg/google/start
→ Google authentication in the system browser
→ auth.picom.gg/google/callback
→ picom://auth/callback?provider=google&state=&code=
→ consume app-held state
→ supabase.auth.exchangeCodeForSession
→ PICOM profile
→ application
```

### EPIC

```text
PICOM Desktop
→ auth.picom.gg/epic/start
→ Epic Games authentication in the system browser
→ auth.picom.gg/epic/callback
→ epic-auth Edge Function verifies the code with the Epic client secret
→ social_auth_external_identities (provider=epic, provider_user_id=Epic account id)
→ one-time handoff consume
→ picom://auth/callback?provider=epic&state=&exchange=
→ steam/epic-auth?action=exchange
→ supabase.auth.setSession
→ PICOM profile
→ application
```

### STEAM

```text
PICOM Desktop
→ auth.picom.gg/steam/start
→ Steam OpenID in the system browser
→ auth.picom.gg/steam/callback
→ steam-auth Edge Function verifies check_authentication + SteamID64
→ social_auth_external_identities (provider=steam, provider_user_id=SteamID64)
→ one-time handoff consume
→ picom://auth/callback?provider=steam&state=&exchange=
→ steam-auth?action=exchange
→ supabase.auth.setSession
→ PICOM profile
→ application
```

## Scorecard

| Area | Status | Evidence |
| --- | --- | --- |
| AUTH UI | PASS | Compact desktop login/register/recovery. Provider buttons always render; disabled providers stay visible with unavailable copy. |
| EMAIL LOGIN | BLOCKED | `supabase.auth.signInWithPassword` + V2 error taxonomy pass source/contract checks, but no authorized real-account smoke was available. |
| REGISTER | BLOCKED | Existing PICOM registration model is retained, but no authorized real-mailbox registration and profile-provisioning smoke was available. |
| GOOGLE | BLOCKED | Source flow is PKCE + `auth.picom.gg` + `picom://auth/callback`. `VITE_SUPABASE_GOOGLE_OAUTH_ENABLED` is DISABLED. Live Google auth was not executed. |
| EPIC | BLOCKED | Server-side code exchange exists. `VITE_EPIC_PORTAL_READY` is MISSING so the button stays disabled. Live Epic auth was not executed. |
| STEAM | BLOCKED | OpenID + SteamID64 verification exists. Steam flag is ENABLED locally, but `https://auth.picom.gg/health` timed out and live Steam auth was not executed. |
| PASSWORD RESET | BLOCKED | Desktop request is enumeration-neutral and its smoke passes, but live mail delivery was not proven. |
| SESSION RESTORE | BLOCKED | Single `useProtectedDesktopSession` restore path exists; packaged reopen evidence is still required. |
| AUTH.PICOM.GG | BLOCKED | `GET /health` now returns `200 OK` over HTTPS, but real provider callback smoke is not yet proven. |
| DEEP LINK | BLOCKED | Parser, cold-start/second-instance wiring, and replay tests pass; packaged runtime callback proof is still required. |
| ACCOUNT LINKING | BLOCKED | Connect/Disconnect code, collision handling, and last-method guard pass source tests; a real linked provider test is still required. |
| PROFILE PROVISIONING | BLOCKED | Canonical trigger and renderer verification are intact; provider-to-profile live proof remains required. |
| SECURITY | PASS | PKCE, consumed state, one-time exchange, no service-role in Desktop, and Electron isolation flags pass code/contract checks. |
| I18N | PASS | Auth catalog keys present in all 10 locales. `i18n-catalog-integrity-smoke` passed. |
| PACKAGED WINDOWS | BLOCKED | Renderer production build and Electron main/preload compile passed. Packaged installer provider E2E was not run. |
| TESTS | PASS | `auth:v2:contract`, Steam/Epic source smoke, password-reset smoke, protocol-handler smoke, login-method guards, preload contract, typecheck, i18n catalog, Vite production build, and Electron main/preload compile pass. |

## Quality gates run

- `npm run typecheck` — PASS
- `npm run auth:v2:contract` — PASS
- `npm run auth:social:steam-epic:smoke` — PASS
- `npm run auth:password-reset:smoke` — PASS
- `npm run protocol-handler:smoke` / `scripts/protocol-handler-smoke-test.mjs` — PASS
- `npm run auth:login-method-guards:unit` — PASS
- `npm run auth:steam:openid-brand` — PASS
- `npm run electron:preload-contract:test` — PASS
- i18n catalog integrity — PASS
- `npm run electron:build` — PASS
- `npm run build:web` — PASS (after explicitly sizing Workbox precache for the 2.79 MiB main entry)
- `npm run package:win:dir` — PASS (unsigned `release/win-unpacked` package created)
- `npm run package:verify` / `npm run electron:security:smoke` — PASS
- `npm run desktop:smoke` — FAIL outside auth scope: existing `src/styles.css` contains a mobile-width media query caught by the desktop-only policy.
- lint — no repository lint script
- packaged Windows provider E2E — NOT RUN

## Files changed (this rebuild)

Desktop UI: `LoginScreen.tsx`, `RegisterScreen.tsx`, `ForgotPasswordScreen.tsx`, `AuthPasswordField.tsx`, `SocialLoginButtons.tsx`, `AccountSummarySection.tsx`, `SettingsModal.tsx`, `App.tsx`, `styles.css`

Auth services: `socialAuthService.ts`, `authErrorMap.ts`, `authAttemptStore.ts`, `socialAuthCallbackState.ts`, `loginMethodGuards.ts`, `useProtectedDesktopSession.ts`, `deepLinkService.ts`

Electron: `main.cts`, `preload.cts`, `ipcPayloadValidation.cts`

i18n: `src/i18n/locales/*/auth.json` and settings locale keys for connected accounts

Tests: `scripts/auth-v2-contract-test.mjs`, `scripts/login-method-guards-unit.mjs`, `scripts/password-reset-smoke-test.mjs`

Docs: `docs/audit/auth-v2-baseline.md`, `docs/audit/auth-v2-provider-configuration.md`, `docs/audit/auth-v2-final-report.md`

## Migrations added

None. Canonical table remains `social_auth_external_identities`. `user_external_identities` was not created.

## Edge Functions / server routes added

None new. Existing `steam-auth`, `epic-auth`, and `services/auth-gateway` start/callback routes remain canonical.

## auth.picom.gg changes

No hosted reverse-proxy configuration was deployed from this session. Source owns `/google`, `/epic`, `/steam` start+callback and `/health`; `GET https://auth.picom.gg/health` returned `200 OK` over HTTPS on 2026-08-23.

## External configuration required before any provider PASS

1. Configure and verify Google in Supabase Auth, allow `https://auth.picom.gg/google/callback` and `picom://auth/callback`, and set the exact Google redirect URI in trusted configuration.
2. Verify the deployed `auth.picom.gg` Google/Epic/Steam callback routes with a real external provider identity.
3. Store Epic client id/secret/deployment id only in Edge/gateway secret storage. Set `VITE_EPIC_PORTAL_READY=true` only after Epic portal + callback are live.
4. Store Steam OpenID/Web API configuration only in trusted server/Edge storage.
5. Run real-account Google, Epic, and Steam smoke on a packaged Windows build, including cold-start and already-running `picom://auth/callback`.

## Remaining blockers

- Google client ID/secret and Supabase redirect allowlist UNVERIFIED; Google redirect URI MISSING in local/runtime configuration
- Epic and Steam trusted credentials UNVERIFIED
- Real `auth.picom.gg` provider callbacks not proven
- Packaged Windows provider + session-restore E2E not executed
- Live password-reset mail delivery UNVERIFIED
