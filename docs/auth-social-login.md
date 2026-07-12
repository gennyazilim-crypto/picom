# Picom Social Login

## Production decision

Google and Apple have disabled foundations. Epic and Steam remain unexposed. No provider is production-approved until hosted configuration, recovery, and packaged Windows/Linux/macOS callback evidence pass.

## Secure shared flow

1. Electron main creates a random expiring attempt with ID, state, nonce, provider, and purpose.
2. Renderer passes the generated callback URL to Supabase signInWithOAuth or linkIdentity.
3. Authorization opens only in the system browser.
4. Supabase owns provider state, PKCE, code exchange, and Picom session authority.
5. Electron validates attempt ID, state, nonce, provider, purpose, expiry, and code/error.
6. Main persists one validated result through OS-protected storage where available.
7. Renderer pulls or receives the typed result, exchanges the code, then acknowledges it.
8. Duplicate, mismatched, expired, canceled, and replayed callbacks fail closed.

No token, assertion, subject, or secret is accepted in the custom protocol.

## Protected sessions

Supabase uses an asynchronous Electron storage adapter instead of ordinary renderer localStorage. Main encrypts at rest with Electron safeStorage when the OS backend is suitable. If protection is unavailable, Picom uses memory-only process storage and does not write plaintext credentials. Linux basic_text is not protected persistence.

## Providers and linking

Google and Apple use built-in Supabase providers and stay disabled until their own tasks pass. Epic requires an approved compatible custom OAuth/OIDC contract. Steam requires official direct OAuth evidence or a trusted server OpenID 2.0/Steamworks bridge.

Supabase identities remain authoritative. Linking still requires Task 636 recent-auth, safe unlink, last-method, collision, recovery, and audit controls. Provider consent never replaces Picom legal acceptance or onboarding. Provider metadata cannot grant verification, roles, permissions, or ownership.

## Operations

Secrets never use VITE_ variables. Provider access tokens are not persisted. Logs redact callback and session material. Task 641 alone may enable a provider.
