# Supabase Auth, Profile, and Onboarding Production Integration

## Runtime transition

Picom keeps the desktop sequence explicit: `FirstLaunchSetup -> Auth -> legal acceptance -> Onboarding -> Mention Feed`. First-launch state is device-local; authenticated identity, profile completion, follows, and theme preference are account-backed in Supabase mode.

## Authentication contract

- Email/password sign-in succeeds only with a real Supabase session. Supabase failures never fall back to mock identity.
- Registration has two successful outcomes: an authenticated session, or an account awaiting email verification. The latter remains on the protected auth boundary and displays a safe success notice.
- Session restore refreshes near-expiry tokens and verifies the user with `auth.getUser()`. Expired or revoked local sessions are cleared and return to sign-in.
- Logout clears the local Supabase session. Password-reset and email-verification redirects continue through the existing safe desktop callback flow.
- OAuth is available only when Supabase mode is configured. The renderer uses the external-link service and exchanges the PKCE callback code through the auth service; UI components do not call Supabase directly.

## Profile provisioning

The existing `auth.users` profile trigger remains the source of initial profile rows. The trigger uses server-owned identity metadata and creates a non-privileged profile; it does not grant community roles or complete onboarding.

## Atomic onboarding completion

`complete_current_user_onboarding` is the authenticated mutation boundary. In one database transaction it:

- validates and updates the current profile only;
- marks onboarding complete with a server timestamp;
- applies at most ten selected follows through the existing privacy/block-aware `follow_user` RPC;
- upserts the account theme into `user_settings`;
- returns the persisted completion time and follow set.

Supabase mode never treats the local onboarding record as authoritative. Mock mode retains its local record so offline development remains deterministic.

## Persistence and restore

- `profiles.onboarding_completed` controls whether the onboarding view is required.
- `user_follows` restores followed-user suggestions and Mention Feed state.
- `user_settings.theme_mode` restores light, dark, or system preference after authentication.
- Community create and invite-join choices continue through the existing confirmed community flows after onboarding; onboarding itself does not bypass community RLS.

## Hosted validation status

Structural contract and local mock checks can run without credentials. A production claim still requires a configured staging project and test inbox to prove registration, verification, login, restart restore, token revocation, onboarding persistence, logout, OAuth callback, community create/join, and cross-device theme/follow restoration. This evidence is **BLOCKED** in an unconfigured checkout and must not be reported as passed.
