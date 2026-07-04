# User profile after signup

Task 127 makes profile creation after signup robust for both future and existing users.

## Future signups

Future email/password signups are handled by the Auth trigger from task 126:

- `public.handle_new_auth_user_profile()`
- `on_auth_user_created_profile`

When Supabase Auth creates a user, the trigger creates a matching row in `public.profiles`.

## Existing users

Task 127 adds a backfill migration:

- `supabase/migrations/20260704001400_profile_signup_backfill.sql`

It inserts missing `public.profiles` rows for existing `auth.users` records that may have been created before the trigger existed.

## Username and display name rules

- Username is derived from the email local part.
- Unsafe characters are replaced.
- A short user-id suffix is appended for uniqueness.
- Display name prefers `raw_user_meta_data.display_name`.
- No password, token, authorization header, or private Auth metadata is copied into `public.profiles`.

## RLS notes

The migration is database-side setup. Runtime client access should still be controlled through RLS policies. Users should only be able to edit their own profile fields unless a trusted admin path is added later.

## Test steps

1. Create a Supabase Auth user before applying this migration.
2. Apply migrations.
3. Confirm a matching `public.profiles` row exists.
4. Register a new user after migrations.
5. Confirm the trigger creates the profile immediately after signup.

## Verification commands

```powershell
npm run supabase:smoke
npm run typecheck
npm run build
```