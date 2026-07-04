# Login/register Supabase Auth connection

Task 126 completes the Supabase Auth connection for Picom login/register.

## Frontend connection

The login and register screens call the centralized `authService`:

- `authService.signInWithEmailPassword()`
- `authService.signUpWithEmailPassword()`

The UI does not call Supabase directly and does not log passwords or tokens.

## Database connection

A migration adds an Auth trigger:

- `public.handle_new_auth_user_profile()`
- `on_auth_user_created_profile` on `auth.users`

When a new Supabase Auth user is created, the trigger creates a matching `public.profiles` row.

## Username behavior

The trigger derives a safe username from the email local part and appends a short user-id suffix. This keeps usernames lowercase, safe, and unique-friendly while preserving the profile constraints.

Example:

- `new@picom.local` -> `new-abc123`

## Security notes

- The trigger uses `security definer` with fixed `search_path = public`.
- No password, token, or authorization header is stored in `public.profiles`.
- RLS remains the source of truth for profile/community access.
- Service role keys are not used in the Electron renderer.

## Test steps

1. Run local Supabase migrations.
2. Start Picom with `VITE_DATA_SOURCE=supabase` and renderer-safe Supabase env values.
3. Register a new email/password user from the desktop register screen.
4. Confirm `auth.users` contains the user.
5. Confirm `public.profiles` contains a matching `id` row.
6. Sign out and sign in again with the same credentials.

## Verification commands

```powershell
npm run supabase:smoke
npm run typecheck
npm run build
```