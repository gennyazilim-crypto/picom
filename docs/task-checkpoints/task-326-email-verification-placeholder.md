# Task 326 - Email Verification Placeholder

## Status

Completed.

## Summary

- Added email verification fields and placeholder auth service methods.
- Added Settings > Account email verification placeholder UI.
- Supabase mode can request resend through Supabase Auth when configured.
- Mock mode remains local and non-blocking.
- Added smoke coverage for placeholder wiring and token safety.

## Validation

- `npm run auth:email-verification:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Notes

- Email verification does not block MVP login.
- Final deep link confirmation is intentionally deferred.
