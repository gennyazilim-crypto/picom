# Task 330 - Password reset production

Status: implementation complete; hosted email/provider certification pending.

- Neutral request response prevents account enumeration; renderer cooldown and hosted rate-limit contract are explicit.
- Supabase PKCE recovery uses sanitized `picom://auth/reset-password` deep links.
- Desktop confirm UI requires matching 12-character passwords.
- Successful update globally signs out sessions.
- Passwords/recovery codes are never persisted or logged.
- SMTP/provider delivery, hosted rate limits and platform protocol delivery remain unverified external blockers.

Validation:
- `npm run auth:password-reset:production:test`
- `npm run auth:password-reset:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
