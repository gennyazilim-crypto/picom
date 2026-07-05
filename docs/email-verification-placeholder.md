# Email Verification Placeholder

Picom now includes a safe email verification placeholder.

## Auth service behavior

`authService.requestEmailVerification(email?)`:

- In mock mode, returns a generic success message.
- In Supabase mode, uses the current user email or provided email and calls `supabase.auth.resend({ type: "signup" })`.
- Does not require email verification for MVP login.
- Does not log or expose verification tokens.

`authService.confirmEmailVerificationPlaceholder(token)`:

- Validates that a token-shaped value exists.
- Returns a placeholder message for the future deep link confirmation flow.

## Settings UI

Settings > Account includes:

- Email verification status placeholder.
- Resend verification placeholder action.
- A clear note that email verification is not required for MVP login.

## Not implemented yet

- Final verification deep link screen.
- Production email templates.
- Requirement toggle such as `REQUIRE_EMAIL_VERIFICATION`.
- Backend rate limiting for resend requests.

## Validation

```powershell
npm run auth:email-verification:smoke
```
