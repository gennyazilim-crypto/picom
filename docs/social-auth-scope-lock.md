# Picom Social Authentication Scope Lock

Status: locked by Task 627
Applies to: Tasks 628-641
Release posture: social authentication remains disabled until the final production gate

## Product boundary

Picom social authentication covers desktop Electron sign-in and explicit account linking on Windows, macOS, and Linux. Supabase Auth remains the only Picom session authority.

In scope:

- Existing email/password login, registration, recovery, and session restore.
- Google and Apple through built-in Supabase providers.
- Epic only through a verified standards-compatible Supabase custom OAuth/OIDC provider or separately approved trusted bridge.
- Steam only through officially evidenced direct OAuth or a trusted server-side OpenID/Steamworks bridge.
- Explicit provider linking/unlinking with recovery and anti-lockout controls.
- Provider-neutral profile normalization, legal acceptance, onboarding, audit, rate limits, and packaged callback certification.

Out of scope:

- Embedded provider webviews.
- Renderer-owned provider secrets, assertions, private keys, or API keys.
- Independent Epic/Steam long-lived renderer sessions.
- Silent account merges.
- Provider metadata granting verification, staff, owner, admin, moderator, or community permissions.
- Mobile UI or mobile SDK auth.
- Production claims based only on mock, local, screenshot, flag, or documentation evidence.

## Non-negotiable architecture

### Browser and callback

- Authorization opens in the operating-system browser through validated Electron IPC.
- Supabase OAuth uses Authorization Code with PKCE.
- Provider callbacks first return to an HTTPS endpoint owned by Supabase or a reviewed Picom backend.
- Electron receives only a short-lived code, bounded error, or opaque single-use completion ID.
- Tokens, assertions, secrets, private IDs, and profile payloads never travel in picom:// URLs.
- Main validates exact scheme, host, path, keys, character set, and length before forwarding.
- Windows/Linux argv and second-instance plus macOS open-url must support cold and running app returns.
- Renderer delivery must be durable and acknowledged; fire-and-forget alone is insufficient.
- Supabase state and PKCE remain authoritative. Picom also records provider, purpose, start time, expiry, consumed state, and safe return intent.

### Session storage

- Refresh tokens and PKCE verifiers must not persist in ordinary renderer localStorage, IndexedDB, plain JSON, logs, diagnostics, or React state.
- Task 628 provides a narrow asynchronous storage adapter backed by Electron main and OS-protected storage where available.
- Windows and macOS use an OS-protected encryption/credential boundary.
- Linux detects secure-storage availability. If unavailable, Picom uses a documented session-only fallback or blocks persistence; plaintext fallback is forbidden.
- Sign-out clears persisted auth material, PKCE material, pending attempts, realtime auth, and provider-link state.

### Secrets and provider tokens

- VITE_ configuration is public and never contains provider secrets, Apple keys, Steam keys, service-role keys, or Epic secrets.
- Secrets live only in provider consoles, protected Supabase configuration, or an approved server secret manager.
- Social sign-in requests identity scopes only.
- Picom does not persist provider access/refresh tokens for social login.
- Logs redact codes, callback queries, tokens, state, nonce, provider subjects, relay emails, and credential presence details.

## Identity and account rules

- Supabase auth users and identities are authoritative; profiles are presentation data.
- Sign-in, link, unlink, and merge are distinct.
- Link/unlink require an authenticated user, recent reauth, explicit confirmation, and audit.
- Unlink must leave at least one tested sign-in/recovery method.
- A provider identity linked elsewhere fails closed into recovery/support.
- Automatic same-email linking requires explicit security review and tests.
- Display name, username, avatar, role, badge, or provider email alone never merges accounts.
- Provider outage never blocks email/password.

## Profile, legal, and onboarding rules

- All providers use one metadata allowlist.
- Stable Picom identity uses Supabase user ID.
- Missing display name, username, or avatar is completed in onboarding.
- Apple name absence is expected.
- Provider consent never accepts Picom Terms or Privacy.
- New social users pass current legal acceptance and onboarding before app content.
- Legal acceptance is server-recorded with version and timestamp.
- Provider metadata cannot set verified status, role, permission, age, or legal acceptance.

## Provider lock

| Provider | Approved architecture | Availability rule |
| --- | --- | --- |
| Google | Built-in Supabase Google, system browser, PKCE, exact callback | Disabled until 628, 630, and 635-640 pass |
| Apple | Built-in Supabase Apple web OAuth, system browser, PKCE, exact callback | Disabled until Apple configuration plus 628, 631, and 635-640 pass |
| Epic | Prefer Supabase custom OIDC only if official discovery/JWKS/claims fit; otherwise reviewed bridge | No button or support claim until 632 approves a contract |
| Steam | Direct OAuth only with official evidence; otherwise HTTPS server-side OpenID 2.0/Steamworks bridge | No button or support claim until 633-634 pass |

Apple operations require an owner for six-month client-secret rotation and emergency revocation. Epic work distinguishes EAS Auth from EOS Connect. Steam assertions and Web API keys never enter Electron or its protocol callback.

## UI availability contract

- Buttons enable only when app flag, hosted provider, redirect config, and release evidence agree.
- A build flag alone is insufficient.
- Unavailable providers are hidden or clearly disabled with no fake success.
- Errors distinguish cancellation, outage, invalid/expired callback, collision, legal gate, and configuration failure without secret leakage.
- Settings reads connected identities from Supabase.
- Link/unlink surfaces recent-auth and lockout requirements.

## Security controls

- Exact redirect allowlists; no production wildcard.
- Short-lived single-use completion.
- Attempt expiry, replay rejection, and safe cancellation.
- Rate limits for start, callback, link, unlink, and repeated failures.
- Redacted audit events.
- RLS remains based on authenticated Supabase user ID.
- No service-role key in Electron.
- Existing CSP, context isolation, disabled Node integration, sender checks, and external URL validation stay intact.
- Recovery and last-login-method tests are release gates.

## Evidence before enablement

Each provider requires:

1. Provider and Supabase configuration review without secret exposure.
2. Exact hosted callbacks and redirect allowlists.
3. Real new/returning login, cancel, deny, expiry, replay, and outage cases.
4. Normalization, legal, onboarding, duplicate-email, and collision cases.
5. Link/unlink, recent-auth, last-method, recovery, and audit cases.
6. Packaged Windows cold/running callback proof.
7. Packaged Linux cold/running callback proof.
8. Packaged macOS cold/running callback proof.
9. Restart, refresh, sign-out, offline, and secure-storage failure proof.
10. Log/diagnostic inspection for codes, tokens, subjects, and private metadata.

Local tests support controls but do not replace hosted evidence.

## Task dependency map

| Task | Deliverable | Depends on | Blocks |
| ---: | --- | --- | --- |
| 627 | Audit and scope lock | None | 628-641 |
| 628 | Electron PKCE, durable callback, secure session | 627 | 630-641 |
| 629 | Production login/register/recovery UX | 627; coordinate with 628 | 630-631, 635, 639-641 |
| 630 | Google implementation/config contract | 628, 629 | 635-641 |
| 631 | Apple implementation/rotation contract | 628, 629, Apple inputs | 635-641 |
| 632 | Epic architecture/implementation decision | 627, 628, Epic approval | Downstream if release-scoped |
| 633 | Steam direct OAuth vs bridge decision | 627 | 634 and downstream if release-scoped |
| 634 | Approved Steam implementation | 628, 633, server/provider approvals | Downstream if release-scoped |
| 635 | Metadata normalization/profile bootstrap | All release-scoped providers | 636-641 |
| 636 | Connected account link/unlink/recovery | 628, 635, configured provider | 637, 639-641 |
| 637 | Security, rate limits, abuse, audit | 628, 635, 636 | 638-641 |
| 638 | Domains, redirects, secrets, rotation, operations | 630-634 decisions, 637 | 639-641 |
| 639 | Packaged cross-platform callback/session QA | 628-638 | 640-641 |
| 640 | Real hosted provider E2E evidence | Release providers plus 639 | 641 |
| 641 | Final production gate | 627-640 | Enablement and claims |

If Epic or Steam remains blocked, 640 records it as blocked and 641 keeps it disabled. Missing evidence never becomes a pass.

## Current classifications

- Google: ARCHITECTURE_BLOCKED
- Apple: APPROVAL_BLOCKED
- Epic: APPROVAL_BLOCKED
- Steam: ARCHITECTURE_BLOCKED

Credential/config evidence is absent or inaccessible for all four. Only the owning task with real evidence may change a status.

## Final release rule

Task 641 alone may authorize production. Until then provider flags remain false, Picom makes no provider support claim, email/password remains the recovery path, and any missing approval/configuration/hosted/native evidence is a provider-specific No-Go.
