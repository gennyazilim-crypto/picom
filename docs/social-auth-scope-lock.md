# Picom Social Authentication Scope Lock

Status: locked by Task 627 refresh
Baseline: `b7d3b4f`
Applies to: Tasks 628-641

## Product boundary

Supabase Auth is Picom's only account/session authority. Social authorization runs in the operating-system browser and returns through the validated Electron protocol. Existing email/password, recovery, verification, legal acceptance, onboarding and Feed landing must continue to work.

In scope:

- Google and Apple through built-in Supabase providers.
- Epic only through verified, approved standards-compatible Custom OIDC/OAuth or a separately approved trusted bridge.
- Steam only through evidenced direct Valve OAuth or a server-side OpenID identity bridge.
- OS-protected session/PKCE storage, single-use callback completion and exact protocol validation.
- Provider-neutral profile bootstrap.
- Connected-account link/unlink with recent-auth, collision and last-method controls.
- Rate limits, audit, redirect/domain operations and real hosted/cross-platform evidence.

Out of scope:

- Embedded provider webviews or provider pages in Electron content.
- Mobile SDKs or mobile UI.
- Renderer provider secrets, assertions, API keys or private keys.
- Provider-token persistence without a separately approved provider API use case.
- Silent account merge or profile metadata granting trust/permissions.
- Fake provider sessions, fake PASS evidence or enabled buttons for blocked providers.

## Non-negotiable contracts

### Browser and callback

- Use the system browser through validated preload/main IPC.
- Use Supabase Authorization Code with PKCE.
- Accept only exact allowlisted callback scheme/host/path/keys and bounded code/error values.
- Validate state, nonce, provider, purpose, expiry and single use in main.
- Handle Windows/Linux cold argv and running second-instance plus macOS `open-url`.
- Persist pending completion durably only when OS-protected storage exists; acknowledge after code exchange.
- Never place tokens, assertions, secrets, provider subjects or profile payloads in the protocol URL.

### Session and secrets

- Supabase session/PKCE storage remains behind `secureAuthStorage` and the narrow preload bridge.
- Linux `basic_text` is never accepted as protected persistence; memory-only fallback is allowed.
- Sign-out clears session, realtime authentication, pending callback/link state and protected persistence.
- `VITE_` variables are public configuration only.
- Provider secrets belong only in provider portals, protected Supabase configuration or approved server secret stores.
- Provider tokens are not persisted for social login.

### Identity and profile

- Supabase user ID/identities are authoritative; profiles are presentation data.
- Sign-in, link, unlink and merge are distinct.
- Link/unlink require explicit intent, authenticated/recent session, audit and anti-lockout checks.
- Display name, avatar, username, role or unverified email never links accounts.
- Provider metadata cannot set verification, staff, role, permission, ownership or legal acceptance.
- Missing Apple/name/avatar fields flow through onboarding.

## Provider lock

| Provider | Architecture | Current gate |
| --- | --- | --- |
| Google | Built-in Supabase Google + system browser + PKCE | `CREDENTIAL_BLOCKED`; disabled until Tasks 630 and 638-641 pass |
| Apple | Built-in Supabase Apple web OAuth + system browser + PKCE | `CREDENTIAL_BLOCKED`; disabled until identifiers/key/rotation and Tasks 631/638-641 pass |
| Epic | Approved Custom OIDC first; trusted bridge only if formally reviewed | `APPROVAL_BLOCKED`; no production button/claim |
| Steam | Direct OAuth only with official entitlement; otherwise trusted server-side OpenID 2.0 bridge | `ARCHITECTURE_BLOCKED`; no production button/claim |

## Evidence rule

Each enabled provider needs real provider/Supabase configuration review, exact hosted redirects, successful new/returning login, cancel/deny/expiry/replay/outage cases, legal/onboarding/profile/collision behavior, link/unlink/last-method recovery, packaged Windows/Linux/macOS cold/running callbacks, restart/refresh/sign-out/secure-storage failure, and redacted log inspection.

Task 641 alone may authorize production enablement. Missing credential, approval, hosted, native or security evidence is a provider-specific No-Go, never a skipped PASS. Email/password remains available when any social provider is unavailable.
