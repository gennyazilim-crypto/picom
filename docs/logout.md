# Logout implementation

Task 129 wires logout into the protected Picom desktop app.

## UI entry point

The bottom `UserMiniCard` in `CommunitySidebar` now includes a compact sign-out button.

## Flow

1. User clicks the sign-out button.
2. `UserMiniCard` calls `onLogout`.
3. `CommunitySidebar` forwards the action from `App`.
4. `App` calls `useProtectedDesktopSession().signOut`.
5. The hook calls `authService.signOut()`.
6. Session state is cleared and the login screen is shown again.

## Security notes

Logout is routed through the centralized auth wrapper. No raw tokens, passwords, cookies, or authorization headers are logged.

This UI state is not a security boundary by itself. Supabase session invalidation and RLS remain the source of truth for backend access.

## Test steps

1. Run `npm run dev`.
2. Sign in with the local seed account in mock mode.
3. Click the sign-out button in the bottom user mini card.
4. Confirm the app returns to the login screen.
5. Run `npm run typecheck` and `npm run build`.