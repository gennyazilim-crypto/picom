# Task 123 checkpoint - Auth service wrapper

## Completed

- Added centralized `authService` for email/password sign-in, sign-up, session lookup, user lookup, sign-out, and auth state changes.
- Kept mock mode working without storing passwords.
- Kept Supabase mode behind `getSupabaseClient()` and stable error codes.
- Documented security behavior and test steps.

## Changed files

- `src/services/authService.ts`
- `docs/auth-service-wrapper.md`
- `docs/task-checkpoints/task-123-auth-service-wrapper.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

No UI behavior changed. Components should use this wrapper in future auth integration tasks.