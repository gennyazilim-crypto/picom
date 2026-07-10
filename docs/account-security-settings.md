# Account Security Settings

Task 285 adds account security settings placeholders for the beta desktop app.

## Current behavior

- Settings > Account shows security-oriented placeholder cards.
- The UI separates user-facing account safety text from developer diagnostics.
- No passwords, tokens, cookies, auth headers, service-role keys, signing keys, certificates, or production credentials are displayed.
- Password reset has a PKCE request/confirm implementation; hosted SMTP, redirect and rate-limit validation remain pending. Two-factor authentication remains a placeholder.

## Security assumptions

- Supabase Auth is the future source of truth for login, register, logout, session restore, password reset, and 2FA flows.
- Renderer-visible environment variables must contain only public/safe values.
- Logs and diagnostics must pass through `loggingService` redaction.
- Account security actions must not be implemented with frontend-only enforcement.

## Remaining risks

- Password reset code is prepared, but production readiness remains blocked on hosted email/provider and cross-platform deep-link validation.
- Two-factor authentication is not implemented.
- Active session management is not implemented.
- Account activity history is not implemented.
- Supabase Auth/RLS policies must be verified before beta expansion.

## Manual test steps

1. Run `npm run dev`.
2. Open Settings.
3. Go to Account.
4. Confirm the account security cards render.
5. Click the placeholder actions.
6. Confirm toast feedback appears.
7. Confirm no raw secrets or tokens are shown.
