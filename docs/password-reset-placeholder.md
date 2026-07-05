# Password Reset Flow Placeholder

Picom now includes a safe desktop password reset placeholder.

## Frontend behavior

- Login screen includes a `Forgot password?` action.
- The reset panel asks for an email address.
- The user-facing response is always generic:

```text
If an account exists for that email, password reset instructions will be prepared.
```

This avoids revealing whether an email address is registered.

## Auth service behavior

`authService.requestPasswordReset(email)`:

- Validates that an email value exists.
- In mock mode, returns the generic success message.
- In Supabase mode, calls `supabase.auth.resetPasswordForEmail(email)` when configured.
- Does not expose Supabase provider errors to the user in a way that reveals account existence.

`authService.confirmPasswordResetPlaceholder(newPassword)`:

- Validates minimum password length.
- Returns a placeholder success message for the future deep link reset-confirm flow.

## Not implemented yet

- Final reset confirmation screen.
- Deep link token handling.
- Production email template.
- Rate limiting for reset requests.

## Validation

```powershell
npm run auth:password-reset:smoke
```
