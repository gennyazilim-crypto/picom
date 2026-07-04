# Auth service wrapper

Task 123 adds a centralized `authService` wrapper for Picom authentication.

## File

- `src/services/authService.ts`

## Exposed methods

- `signInWithEmailPassword(email, password)`
- `signUpWithEmailPassword(email, password, displayName?)`
- `getCurrentSession()`
- `getCurrentUser()`
- `signOut()`
- `onAuthStateChange(listener)`

## Why this wrapper exists

React components should not call Supabase Auth directly. Keeping auth behind one service lets Picom:

- Avoid logging passwords or tokens.
- Keep mock mode working without a backend.
- Keep Supabase mode centralized.
- Map provider errors to stable app error codes.
- Handle expired sessions as recoverable desktop app state.

## Security notes

The wrapper intentionally does not return raw access tokens, refresh tokens, authorization headers, password values, or provider stack traces.

`VITE_SUPABASE_ANON_KEY` is allowed in the renderer only when RLS is enabled and enforced. Service-role keys must never be used in the Electron renderer.

## Mock mode behavior

When `VITE_DATA_SOURCE=mock`, sign-in and sign-up return a deterministic mock session summary. No password is stored.

## Supabase mode behavior

When `VITE_DATA_SOURCE=supabase`, the service requires:

```powershell
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

If values are missing, the service returns `AUTH_NOT_CONFIGURED` instead of throwing.

## Test steps

1. Run `npm run typecheck`.
2. Run `npm run build`.
3. In mock mode, call the wrapper from a future auth UI without requiring a backend.
4. In Supabase mode, configure `.env.local` and test sign-in with local seed users.