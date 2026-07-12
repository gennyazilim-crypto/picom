# Picom Social Authentication Current-State Audit

Audit date: 2026-07-12
Baseline: origin/main at c332730
Scope: Task 627, read-only product audit

## Executive verdict

Picom has a useful Google and Apple proof-of-concept path, but no social provider is production-ready. The implementation already uses the system browser, Supabase Auth, PKCE, a bounded picom://auth/callback parser, and a narrow Electron preload event. Production enablement remains blocked by the desktop session-storage boundary, incomplete callback certification, unverified hosted provider configuration, and incomplete account-linking controls.

Epic and Steam are not implemented or exposed. Epic remains approval-blocked until a supported OAuth/OIDC contract is confirmed. Steam remains architecture-blocked because the public Steam browser sign-in contract is OpenID 2.0, not a drop-in Supabase OAuth/OIDC provider.

No provider is approved for a production feature flag, beta claim, or release evidence.

## Evidence policy

| Evidence | Result |
| --- | --- |
| Product source, migrations, local Supabase config, lockfile, Electron builder config | Inspected |
| Current process environment | Audited for presence only; values were never requested or printed |
| GitHub repository secret names | Unavailable to the authenticated CLI identity; GitHub returned HTTP 403 |
| Hosted Supabase Auth provider configuration | Not verified |
| Google, Apple, Epic, and Steam developer-console configuration | Not verified |
| Real hosted provider login | Not run |
| Packaged Windows, Linux, and macOS callback return | Not run |

An absent local variable is not proof that a hosted secret is absent. A UI flag or placeholder is not proof that a provider is configured.

## Locked runtime inventory

| Dependency | Locked version | Audit consequence |
| --- | ---: | --- |
| Electron | 43.0.0 | Current protocol, single-instance, open-url, and preload contracts apply |
| @supabase/supabase-js | 2.110.0 | PKCE, signInWithOAuth, exchangeCodeForSession, and identity linking are available |
| @supabase/auth-js | 2.110.0 | Session persistence follows the locked Supabase Auth client |
| electron-builder | 26.15.3 | The picom protocol is declared for packaged apps |
| React | 19.2.7 | Renderer auth routing is effect-driven |
| Vite | 8.1.3 | Every VITE_ value is renderer-visible and cannot contain a provider secret |

## Current application flow

1. LoginScreen and RegisterScreen render SocialLoginButtons.
2. Only Google and Apple exist in SocialAuthProvider.
3. socialAuthService calls Supabase signInWithOAuth with skipBrowserRedirect and picom://auth/callback.
4. externalLinkService accepts only HTTP(S). Electron invokes a narrow preload API and the main process uses shell.openExternal.
5. Supabase and the provider complete their hosted exchange, then Supabase returns a short-lived code through the custom protocol.
6. Electron validates the URL in main and preload boundaries and forwards it to the renderer.
7. deepLinkService accepts only a bounded code or bounded error.
8. socialAuthService calls exchangeCodeForSession and attempts an allowlisted profile upsert.
9. Auth state is restored, current legal-version acceptance is checked, and onboarding follows when required.
10. Completed onboarding uses the authenticated landing policy, currently the Mention Feed.

## UI and service inventory

| Area | Current state | Gap |
| --- | --- | --- |
| Login | Google and Apple buttons exist; unavailable providers are disabled | Generic icon, development seed defaults, no Epic/Steam |
| Register | Social buttons require the legal checkbox before launch | Provider login does not carry legal-version metadata; the post-login legal gate is still mandatory |
| OAuth service | Built-in Supabase Google/Apple path exists | No app-level attempt expiry, completion acknowledgement, or provider-specific error contract |
| Connected accounts | Settings reads Google/Apple identities and can call linkIdentity | Local manual linking is disabled; no recent reauth, unlink, or last-method protection |
| Session restore | Near-expiry refresh and getUser verification exist | Persistent credentials are renderer-readable |
| Profile bootstrap | Bounded name/username and allowlisted avatar are used | Trigger and social upsert can discard provider metadata |
| Provider flags | Google/Apple flags default false | A flag does not prove dashboard or redirect correctness |
| Epic | No type, button, flag, callback, or service | Provider contract and approval are absent |
| Steam | No type, button, flag, callback, or service | A reviewed OpenID/Steamworks server bridge is required |

## Electron protocol and callback audit

### Registration and validation

- electron-builder.yml declares the picom protocol.
- Development registration uses app.setAsDefaultProtocolClient with the Electron executable and app path.
- Packaged registration uses app.setAsDefaultProtocolClient for picom.
- Main, preload, and renderer reject unsupported protocols, embedded credentials, fragments, unknown query keys, invalid codes, control characters, and overlong links.
- The auth callback allows only code, error, and error_description.
- Tokens, assertions, provider subjects, and secrets are not accepted in callback URLs.

### Cross-platform dispatch matrix

| Platform/state | Implemented path | Result |
| --- | --- | --- |
| Windows cold | Initial argv is scanned and queued | Implemented, not packaged-certified |
| Windows running | second-instance argv is scanned | Implemented, not packaged-certified |
| Linux cold | Initial argv is scanned and queued | Implemented; packaged registration required; not certified |
| Linux running | second-instance argv is scanned | Implemented, not packaged-certified |
| macOS cold/running | open-url is validated and queued/dispatched | Implemented, not signed-bundle-certified |

The native renderer listener starts before React renders, and pending links flush on did-finish-load. The final action listener is installed by a React effect. There is no acknowledgement or pull-based pending callback API, so a narrow startup timing window can drop an action before the app listener is ready. This is an unclosed production risk, not proof that a packaged flow fails. Task 628 must make delivery durable and testable.

Supabase owns OAuth state and the PKCE verifier. Picom has no additional bounded attempt record containing provider, purpose, initiation time, expiry, consumed state, and safe return intent. Task 628 must add that lifecycle without replacing or weakening Supabase state/PKCE.

## PKCE and session-storage audit

The Supabase client uses:

- flowType: pkce
- detectSessionInUrl: false
- persistSession: true
- autoRefreshToken: true

No custom Supabase storage adapter is provided. In Electron this uses ordinary renderer browser storage for the PKCE verifier and Supabase session, including the refresh token. A renderer compromise can read that material. There is no OS-protected store or safe session-only behavior when secure persistence is unavailable.

This is the highest shared architecture blocker. Task 628 must move persistent auth material behind a narrow main/preload boundary, define Linux keyring failure behavior, retain refresh semantics, and keep raw tokens out of logs, diagnostics, plain files, and UI state.

Positive controls already present:

- Context isolation is enabled and Node integration is disabled.
- UI components do not receive raw tokens.
- AuthServiceSession exposes bounded user/session metadata.
- Restored sessions are verified with getUser.
- Sign-out removes realtime channels.

## Account linking and duplicate identity audit

- Supabase auth users and identities remain authoritative.
- Settings derives connected Google/Apple state from user.identities.
- Local supabase/config.toml has enable_manual_linking = false.
- Hosted manual-linking configuration is unknown.
- Linking checks for an active user but not recent authentication.
- No unlink implementation exists.
- No last-usable-method guard or provider-collision recovery UI exists.
- Supabase automatic linking can combine identities sharing a verified email. Picom has not yet recorded and tested a production policy for this behavior.
- No display name, username, avatar, or matching email alone may silently merge Picom profiles.

Task 636 must keep sign-in, link, unlink, and merge as distinct operations.

## Provider metadata and profile normalization

socialAuthService accepts a small allowlist:

- Display name: display_name, full_name, name, then email prefix.
- Avatar: avatar_url only.
- Username: sanitized email prefix plus a stable user-id suffix.

The auth-user trigger creates the profile first and reads only display_name. The later social upsert uses ignoreDuplicates. A trigger-created row can therefore prevent richer allowlisted social metadata from being applied. Apple OAuth may also omit a full name. Task 635 must establish one provider-neutral normalization contract and preserve onboarding as the authority for missing user-facing fields.

Provider metadata must never grant verification, staff, roles, permissions, legal acceptance, or ownership.

## Configuration and credentials audit

Repository configuration contains public placeholders only:

- VITE_SUPABASE_OAUTH_REDIRECT_URL defaults to picom://auth/callback.
- Google and Apple availability flags default false.
- Provider secrets are documented as Supabase-dashboard-only.
- No Epic or Steam renderer configuration exists.
- Local Supabase redirect configuration includes callback, password reset, and email verification.

The current shell had no audited Supabase/provider variables. GitHub secret-name inspection returned HTTP 403. No hosted Supabase or provider dashboard was inspected. Credential, domain, consent-screen, Services ID, signing-key, redirect, and approval readiness are therefore unverified.

## Provider classification

The primary status is the first blocking condition; secondary blockers still apply.

| Provider | Primary status | Repository readiness | Secondary blockers | Next decision |
| --- | --- | --- | --- | --- |
| Google | ARCHITECTURE_BLOCKED | Built-in Supabase flow and disabled UI exist | Credentials, consent screen, hosted redirect allowlist, and packaged callback evidence unverified | Complete 628, then 630; remain disabled until hosted evidence passes |
| Apple | APPROVAL_BLOCKED | Built-in Supabase flow and disabled UI exist | Shared 628 blockers plus Developer enrollment, App ID, Services ID, domain, key, rotation owner, and hosted evidence | Confirm approvals; complete 628 and 631 |
| Epic | APPROVAL_BLOCKED | POC documentation only | EAS use case, issuer/endpoints, client approval, Supabase custom-provider fit, and bridge are unverified | 632 may proceed only with official approved inputs |
| Steam | ARCHITECTURE_BLOCKED | POC documentation only | Official public browser contract is OpenID 2.0; no direct OAuth/OIDC entitlement or trusted bridge exists | 633 must approve architecture before 634 |

No provider is READY_TO_IMPLEMENT as a production-enabled login today. Credential evidence is absent or inaccessible for every provider.

## Ranked release blockers

| Priority | Blocker | Impact | Owner |
| --- | --- | --- | --- |
| P0 | Session and PKCE storage are renderer-readable | Refresh-token theft after renderer compromise | 628 |
| P0 | Callback delivery is event-only and unacknowledged | Cold-start completion can be lost or ambiguous | 628, 639 |
| P0 | No real provider or packaged callback evidence | Social login cannot be claimed or enabled | 630-631, 638-640 |
| P1 | Linking lacks recent-auth and unlink/lockout policy | Account takeover or lockout risk | 636-637 |
| P1 | Hosted provider/manual-linking state is unverified | UI can fail despite enabled flags | 630-631, 638 |
| P1 | Epic provider contract is unknown | Unsupported or unsafe bridge risk | 632 |
| P1 | Steam requires a trusted bridge | Assertion/API-key exposure risk | 633-634 |
| P2 | Trigger and service normalize metadata differently | Missing or inconsistent profiles | 635 |
| P2 | Login/register contain development seed defaults | Production UX and credential confusion | 629 |

## Official references reviewed

- Supabase PKCE: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Supabase redirects: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Apple: https://supabase.com/docs/guides/auth/social-login/auth-apple
- Supabase identity linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Supabase custom OAuth/OIDC: https://supabase.com/docs/guides/auth/custom-oauth-providers
- Electron deep links: https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Apple environment: https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple
- Epic Auth: https://dev.epicgames.com/docs/api-ref/interfaces/auth
- Steam authentication/OpenID: https://partner.steamgames.com/doc/features/auth

## Conclusion

The code is a disabled foundation, not a production social-auth implementation. Task 628 is mandatory next. Buttons must remain unavailable until provider-specific work, hosted configuration, security controls, packaged callback evidence, and Task 641 all pass.
