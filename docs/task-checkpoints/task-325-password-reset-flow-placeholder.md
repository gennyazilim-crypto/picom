# Task 325 - Password Reset Flow Placeholder

## Status

Completed.

## Summary

- Added a safe forgot-password placeholder panel to the login screen.
- Added `authService.requestPasswordReset()` and `authService.confirmPasswordResetPlaceholder()`.
- Supabase mode can call `resetPasswordForEmail()` when configured.
- Mock mode remains fully local and returns the same generic response.
- Added smoke coverage for the no-account-enumeration copy.

## Validation

- `npm run auth:password-reset:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Notes

- The final deep link confirmation flow is intentionally deferred.
- The UI does not reveal whether an email exists.
