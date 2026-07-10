# Task 331 - Email verification production

Status: implementation complete; enforcement disabled pending hosted certification.

- Neutral resend response and renderer cooldown are implemented.
- PKCE confirmation uses sanitized `picom://auth/verify-email` across renderer/preload/main validation.
- Settings shows required/recommended/verified status.
- `VITE_REQUIRE_EMAIL_VERIFICATION` defaults false for safe rollout.
- No verification codes are persisted or logged.
- Hosted SMTP, rate limits, delivery and platform callbacks remain external blockers.

Validation:
- `npm run auth:email-verification:production:test`
- `npm run auth:email-verification:smoke`
- `npm run protocol-handler:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
