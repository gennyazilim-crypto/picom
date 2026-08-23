# PICOM Authentication V2 baseline audit

Audit date: 2026-08-23  
Scope: desktop renderer, Account Center, Electron main/preload, Supabase Auth, custom social-auth Edge Functions, and `auth.picom.gg` gateway source.

## Canonical boundaries found

- Supabase Auth is the only session authority in the application source.
- `profiles.id` is linked to `auth.users.id` through the existing profile trigger and onboarding migrations.
- `auth.picom.gg` is the public gateway for Google, Steam, and Epic. Source lives in `services/auth-gateway/`.
- Canonical desktop callback is `picom://auth/callback`.
- Canonical external identity table is `social_auth_external_identities` (do not create `user_external_identities`).
- No Firebase, Clerk, Auth0, or second JWT/session implementation was found.

## Inventory and classification

| Area | Evidence | Status | Finding |
| --- | --- | --- | --- |
| Email/password sign-in | `src/services/authService.ts` | WORKING (source) | Uses `signInWithPassword` with V2 error taxonomy. Live hosted proof is still required. |
| Registration | `src/services/authService.ts`, profile trigger | WORKING (source) | In-app desktop register is wired. Canonical `auth.users` / `profiles` relationship is preserved. |
| Password recovery | `authService.ts`, `ForgotPasswordScreen.tsx`, Account Center reset page | WORKING (source) | Desktop request is neutral. Reset completion stays on `account.picom.gg`. Live mail delivery is unverified. |
| Session restore/logout | `useProtectedDesktopSession.ts` | WORKING (source) | Single hook restores through Supabase PKCE persistence. Packaged Windows restore still needs a live run. |
| Google OAuth | `socialAuthService.ts`, gateway `/google/*` | PARTIAL | PKCE + `auth.picom.gg` + `picom://auth/callback` are implemented. Button enablement depends on `VITE_SUPABASE_GOOGLE_OAUTH_ENABLED` and hosted Google/Supabase config. |
| Epic OAuth | `epic-auth`, gateway, social auth service | PARTIAL | Server-side code exchange, verified account mapping, rate limiting, one-time exchange, and desktop callback exist. Credentials and hosted callback deployment are local-MISSING. |
| Steam sign-in | `steam-auth`, gateway, social auth service | PARTIAL | OpenID assertion + SteamID64 mapping + one-time exchange + desktop callback exist. Steam Web API key / hosted realm proof are local-MISSING. |
| External identity mapping | `social_auth_external_identities` | WORKING (source) | Service-role-only, unique per `(provider, external_id)`. Renderer cannot INSERT. |
| Connected accounts | Settings Account → Connected accounts | WORKING (source) | In-app Connect/Disconnect for Google/Epic/Steam. Duplicate identity returns `AUTH_IDENTITY_ALREADY_LINKED`. |
| Profile provisioning | Auth profile trigger + `ensureProfile` | WORKING (source) | Trigger is canonical. Renderer only verifies the profile exists. |
| Electron protocol | `electron/main.cts`, preload, renderer | WORKING (source) | First instance, second instance, macOS `open-url`, cold-start buffer, focus, strict URL parsing, replay-resistant app-held state, `picom://auth/open` focus-only. Packaged runtime evidence still required. |
| Gateway routes | `services/auth-gateway/` | PARTIAL | `/google`, `/epic`, `/steam` start+callback and `/health` exist. On 2026-08-23, `GET https://auth.picom.gg/health` returned `200 OK` over HTTPS. Provider callback smoke remains unverified. |
| I18N | `src/i18n/locales/*/auth.json` | WORKING (source) | Auth UI and error taxonomy keys exist in all 10 locales. |

## Security findings already remediated in V2 source

1. Steam/Epic completion uses a one-time `exchange` on `picom://auth/callback`, not an unauthenticated poll loop from the desktop UI.
2. Callback state is application-held, provider-bound, TTL-limited, and consumed before token exchange (replay fail-closed).
3. Gateway requires the publishable/anon key and must not substitute a service-role secret.
4. `picom://auth/open` focuses the desktop window and is not forwarded as an auth callback.
5. Provider secrets are absent from React, preload, Vite public env, and bundled renderer source.

## Remaining non-source blockers

- Hosted Google/Epic/Steam credentials and redirect allowlists.
- Deployed provider callback smoke through `auth.picom.gg`; the health endpoint itself is now reachable.
- Real provider smoke and packaged Windows deep-link evidence.
