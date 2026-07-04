# Register screen desktop UI

Task 125 adds the Picom desktop register screen.

## Files

- `src/components/RegisterScreen.tsx`
- `src/components/LoginScreen.tsx`
- `src/App.tsx`
- `src/styles.css`

## Behavior

- Login screen now includes a `Create a new account` action.
- Register screen includes display name, email, password, and confirm password fields.
- Password confirmation and minimum length validation run locally before calling auth.
- Registration uses `authService.signUpWithEmailPassword()`.
- Successful registration opens the existing 4-column desktop chat layout.
- Theme toggle works from the register screen.

## Security notes

The register screen does not log passwords or tokens. It uses the centralized auth wrapper and shows user-friendly inline errors.

## Test steps

1. Run `npm run dev`.
2. On the login screen, click `Create a new account`.
3. Confirm the register screen appears inside the same app frame.
4. Try mismatched passwords and confirm inline validation appears.
5. Submit valid local development values and confirm the chat layout opens in mock mode.
6. Run `npm run typecheck` and `npm run build`.