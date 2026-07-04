# Login screen desktop UI

Task 124 adds the Picom desktop login screen.

## Files

- `src/components/LoginScreen.tsx`
- `src/App.tsx`
- `src/styles.css`

## Behavior

- The custom Picom Electron titlebar remains visible.
- The login screen renders inside the same rounded desktop app frame.
- In mock mode, the local seed account can sign in without a backend.
- In Supabase mode, the screen uses `authService.signInWithEmailPassword()`.
- Passwords are never logged.
- User-facing auth errors are shown inline.
- Theme toggle works from the login screen.

## Desktop-only design notes

The login layout is a fixed desktop composition with a hero panel and auth card. It does not introduce mobile navigation or web-first responsive behavior.

## Security notes

The login screen does not call Supabase directly. It uses the centralized `authService`, which returns safe session summaries and redacts provider details.

## Test steps

1. Run `npm run dev`.
2. Confirm only the custom Picom titlebar is visible.
3. Confirm the login screen is contained inside the app frame.
4. Click theme toggle and confirm light/dark mode changes.
5. Click `Sign in` with the local seed credentials.
6. Confirm the existing 4-column desktop chat layout appears.
7. Run `npm run typecheck` and `npm run build`.