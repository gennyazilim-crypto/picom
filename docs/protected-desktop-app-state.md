# Protected desktop app route/state

Task 128 centralizes Picom's protected desktop app state.

## File

- `src/hooks/useProtectedDesktopSession.ts`

## Responsibilities

The hook owns:

- Initial session check.
- Auth state subscription.
- Login action.
- Register action.
- Sign-out action placeholder for future UI.
- Loading state.
- User-friendly error state.
- Safe auth warnings through `loggingService` without passwords or tokens.

## App behavior

`src/App.tsx` now uses `useProtectedDesktopSession()` to decide whether to render:

- Login screen.
- Register screen.
- Protected 4-column desktop chat shell.

## Security notes

The protected state is a UX guard, not a security boundary. Supabase RLS remains the source of truth for data access.

The hook only stores a safe session summary returned by `authService`. It does not expose or log raw access tokens, refresh tokens, authorization headers, or passwords.

## Test steps

1. Run `npm run dev`.
2. Confirm the login screen appears when no session exists.
3. Sign in with the mock/local seed account.
4. Confirm the 4-column desktop app appears.
5. Refresh the renderer and confirm the auth state check runs without crashing.
6. Run `npm run typecheck` and `npm run build`.