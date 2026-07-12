# Picom Social Authentication Current-State Audit

Audit date: 2026-07-12
Baseline: `origin/main` at `b7d3b4f`
Scope: Task 627, documentation-only product audit

## Executive verdict

Picom now has a credible production foundation for email/password plus external-browser Google and Apple OAuth. Supabase Auth remains the sole session authority; the client uses PKCE, a validated `picom://auth/callback`, durable single-use native callback delivery, and an OS-protected Supabase storage adapter with a memory-only fallback when secure persistence is unavailable.

No social provider is production-enabled or release-certified. Google and Apple are code-ready but credential/configuration evidence is absent. Epic lacks an approved real application/provider contract. Steam lacks evidence for direct Valve OAuth and has no deployed server-side OpenID bridge. Provider flags therefore remain disabled.

This refresh supersedes the pre-Task-628 findings retained in Git history. No product source was changed by this audit.

## Locked runtime inventory

| Dependency | Lockfile version | Audit consequence |
| --- | ---: | --- |
| Electron | 43.0.0 | Current protocol, `safeStorage`, single-instance, `open-url`, sandbox and preload contracts apply |
| `@supabase/supabase-js` | 2.110.0 | PKCE, code exchange, built-in providers and identity APIs are available |
| electron-builder | 26.15.3 | `picom` protocol is declared in packaged metadata |
| Picom | 0.1.1-beta.1 | Social providers remain pre-release and disabled by default |

No Node `engines` contract is present in `package.json`; CI/runtime alignment remains a general release concern rather than a provider decision.

## Current architecture

1. Login and Register use the existing typed auth service. Email/password, recovery, verification, logout and session restore are retained.
2. `SocialLoginButtons` exposes only Google and Apple and reads explicit disabled-by-default feature flags.
3. `socialAuthService` starts a native attempt, asks Supabase for a PKCE authorization URL with `skipBrowserRedirect`, and opens it through the operating-system browser.
4. Electron main owns OAuth attempt state. Attempt ID, provider, purpose, state, nonce, start/expiry and completion state are encrypted with OS `safeStorage`; unavailable or Linux `basic_text` storage fails to memory-only persistence.
5. Main accepts only the exact `picom://auth/callback` route and bounded allowlisted query parameters. State/nonce/provider/purpose are compared in constant time, expired/replayed callbacks fail closed, and successful results are single-use.
6. Cold-start argv, running `second-instance`, and macOS `open-url` paths feed the same validator. Pending completion is pullable after renderer startup and explicitly acknowledged after exchange.
7. The renderer receives only a bounded authorization code or safe error, then calls Supabase `exchangeCodeForSession`.
8. Supabase session/PKCE persistence uses the narrow `secureAuthStorage` preload bridge, not ordinary renderer `localStorage` or a plain file.
9. The auth-user trigger creates `profiles`; the social service performs an idempotent fallback profile upsert. Legal acceptance and onboarding remain separate gates. Completed auth/onboarding routes to Mention Feed.

## Security observations

### Positive controls

- `contextIsolation: true`, `nodeIntegration: false`, and sandboxing are retained.
- Provider pages are never embedded in Picom.
- Callback scheme, host, path, key set, cardinality, character set, TTL and replay are validated.
- The protocol is registered in electron-builder and at runtime.
- OS-backed persistence uses DPAPI/Keychain/Linux secret storage; Linux `basic_text` is rejected.
- Refresh/access/provider tokens are not placed in deep links, React props, diagnostics or repository files.
- UI components use services rather than direct Supabase calls.
- Email/password remains available independently of provider outages.

### Remaining risks

- Electron 43 offers asynchronous `safeStorage`; Picom still uses synchronous encryption. This is not plaintext exposure, but Task 628 follow-up should evaluate non-blocking/key-rotation migration.
- The native external-link boundary permits any syntactically safe HTTP(S) URL. The URL originates from Supabase, but Task 637 should add an OAuth-specific origin/host contract and audit telemetry.
- Provider dashboard enablement, exact hosted redirect allowlists, consent configuration, secret custody and real hosted login are unverified.
- Packaged Windows/Linux/macOS cold/running callback paths are implemented but not certified.
- Account linking has no unlink, recent-auth or last-login-method guard yet.
- Profile trigger and fallback upsert normalize metadata differently; provider-neutral normalization remains Task 635.

## Protocol and session matrix

| Area | Current implementation | Evidence status |
| --- | --- | --- |
| Windows cold callback | Initial argv queued and validated | Source/contract only; packaged evidence pending |
| Windows running callback | Single-instance argv validated | Source/contract only; packaged evidence pending |
| Linux cold/running callback | Same argv paths; packaged protocol required | Source/contract only; native evidence pending |
| macOS callback | `open-url` validated and dispatched | Source/contract only; signed bundle evidence pending |
| PKCE | Supabase `flowType: "pkce"`, URL detection disabled | Implemented |
| Durable completion | Protected pending result + pull + acknowledgement | Implemented |
| Session persistence | Supabase custom storage -> preload -> `safeStorage` | Implemented; platform certification pending |
| Secure-storage failure | Memory-only, non-persistent fallback | Implemented |

## Identity/profile audit

- Supabase user ID and identities are authoritative.
- Provider name/avatar/email never grants verification, staff, role, permission, ownership or legal acceptance.
- Existing metadata candidates are bounded (`display_name`, `full_name`, `name`, `avatar_url`).
- Trigger-created profiles can prevent richer social metadata from being applied because the fallback upsert ignores duplicates.
- Apple OAuth may omit full name; onboarding must remain authoritative for missing user-facing fields.
- Automatic same-verified-email linking is a Supabase behavior that requires explicit collision/recovery tests.
- Linking, unlinking and merging remain distinct operations; display name/avatar/unverified email cannot merge accounts.

## Provider classification

| Provider | Status | Repository readiness | Blocking evidence |
| --- | --- | --- | --- |
| Email/password | READY_TO_IMPLEMENT | Existing login/register/recovery/session/onboarding path is implemented | Hosted SMTP and final production QA remain release evidence |
| Google | CREDENTIAL_BLOCKED | Built-in Supabase flow, button, flag and callback foundation exist | Google client, consent screen, Supabase provider config, redirects and real hosted login not verified |
| Apple | CREDENTIAL_BLOCKED | Built-in Supabase flow, button, flag and callback foundation exist | Developer identifiers, Services ID, domain, `.p8` custody, generated secret, rotation owner and real hosted login not verified |
| Epic | APPROVAL_BLOCKED | Native attempt type exists; no renderer/provider implementation is enabled | Approved Epic application, issuer/discovery/claims and Supabase custom OIDC compatibility are unverified |
| Steam | ARCHITECTURE_BLOCKED | Native attempt type exists; no production button/provider is enabled | Direct Valve OAuth entitlement is unverified; public Steam OpenID 2.0 requires a trusted server bridge |

No local `.env` with real provider values was found. Repository examples contain public placeholders only. This does not prove hosted secrets are absent; it means they were not evidenced in this audit. No secret value was read or printed.

## Steam decision inputs

1. Obtain written/portal evidence of a Valve OAuth client and supported authorization/token/user-info contract.
2. If that contract fits Supabase Custom OAuth, use `custom:steam` through the existing browser/PKCE/callback foundation.
3. If only Steam OpenID 2.0 is available, do not label it OAuth/OIDC. Build an approved server-side identity bridge that verifies assertions with Steam, emits its own short-lived OAuth/OIDC result, protects signing/Web API keys, and exposes discovery/JWKS where required.
4. If neither exists, Steam remains hidden/disabled and Task 634 is blocked.

## Task dependency map

| Task | Deliverable | Status/dependency |
| ---: | --- | --- |
| 627 | Current audit and scope lock | Refreshed on `b7d3b4f` |
| 628 | PKCE, durable callback, secure session | Foundation already present; revalidate against this baseline |
| 629 | Production auth/recovery UI | Depends on 627-628 |
| 630 | Google integration and hosted configuration | Depends on credentials plus 628-629 |
| 631 | Apple integration and rotation operations | Depends on Apple inputs plus 628-629 |
| 632 | Epic provider contract | Depends on Epic approval and official endpoints |
| 633 | Steam direct OAuth vs bridge decision | Blocks 634 |
| 634 | Approved Steam provider/bridge | Depends on 633 and server/provider approvals |
| 635 | Provider-neutral profile normalization | Depends on all release-scoped provider contracts |
| 636 | Link/unlink/recovery | Depends on 628 and 635 |
| 637 | Rate limits, abuse controls and audit | Depends on 628 and 636 |
| 638 | Domains, redirects, secret custody and operations | Depends on provider decisions and 637 |
| 639 | Cross-platform packaged callback/session QA | Depends on 628-638 |
| 640 | Real hosted four-provider E2E | Depends on configured release providers and 639 |
| 641 | Final production gate | Depends on truthful 627-640 evidence |

## Official references reviewed

- Supabase PKCE: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Supabase Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Apple: https://supabase.com/docs/guides/auth/social-login/auth-apple
- Supabase custom OAuth/OIDC: https://supabase.com/docs/guides/auth/custom-oauth-providers
- Supabase identity linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Electron deep links: https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Electron `safeStorage`: https://www.electronjs.org/docs/latest/api/safe-storage
- electron-builder protocol configuration: https://www.electron.build/docs/configuration/
- Steam browser authentication/OpenID: https://partner.steamgames.com/doc/features/auth
- Steam OAuth availability: https://partner.steamgames.com/doc/webapi_overview/OAuth

## Release posture

Social authentication remains No-Go for production enablement. Google/Apple stay disabled until real hosted and packaged evidence passes. Epic/Steam stay unavailable until their architecture and approvals are evidenced. Local code, flags, screenshots or documentation never count as provider success.
