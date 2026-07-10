# Password reset production

Picom uses Supabase Auth's PKCE recovery flow. The login screen accepts an email and always returns the same safe request message whether an account exists or not. A 60-second in-memory desktop cooldown prevents accidental repeat clicks; hosted Supabase Auth email rate limits remain authoritative and must be configured/tested separately.

Recovery email redirects to `picom://auth/reset-password`. The deep-link parser accepts only a bounded PKCE `code`, optional `type=recovery`, or a bounded safe error. It rejects fragments/unknown query keys and returns a sanitized URL so recovery values do not enter logs or diagnostics. `exchangeCodeForSession` establishes the temporary recovery session, then the desktop requires matching passwords of at least 12 characters. `updateUser` changes the password and global sign-out revokes existing sessions.

No password or recovery code is written to logs, local settings, diagnostics, analytics or application database. Picom does not accept implicit-flow access/refresh tokens in URL fragments. Expired/invalid links show neutral recovery copy and require a new request.

## Hosted staging/production gate

Before external use, the hosted staging project must configure and verify Supabase Auth custom SMTP/email provider, sender domain and authentication, recovery template/branding, `picom://auth/reset-password` redirect allowlist, provider and Auth request rate limits, abuse monitoring, bounce/suppression handling, support ownership and email deliverability. Test existent/nonexistent addresses for indistinguishable UI/timing, cooldown/429 behavior, expired/reused codes, changed passwords, global session revocation and Windows/Linux/macOS protocol delivery. No provider configuration or email delivery was proven by repository tests.
