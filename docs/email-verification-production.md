# Email verification production

Picom prepares a Supabase Auth PKCE email-verification flow. Resend returns the same safe message regardless of provider/account state and uses a 60-second in-memory cooldown; hosted Auth/provider rate limits remain authoritative. Verification redirects to `picom://auth/verify-email`, whose renderer, preload and main-process validators accept only bounded PKCE code/error fields and return a sanitized URL.

The app exchanges the one-time code for a Supabase session, reads `email_confirmed_at`, and shows success without displaying or logging the code. Settings > Account shows **Email verified**, **Verification required**, or **Verification recommended** according to the authenticated user and `VITE_REQUIRE_EMAIL_VERIFICATION`. The flag defaults false and must not be enabled merely because UI exists.

Before enabling it, the hosted staging project must prove custom SMTP/provider setup, sender authentication/reputation, templates, `picom://auth/verify-email` allowlist, resend/provider rate limits, existent/nonexistent neutral behavior, expired/reused codes, session behavior and Windows/Linux/macOS protocol delivery. Registration/login enforcement policy, support recovery, email-change verification and rollback require product/security/legal approval. Repository tests do not prove email delivery.
