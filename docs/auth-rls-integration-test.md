# Auth and RLS integration test

Task 141 defines the integration verification path for Supabase Auth plus RLS.

## Purpose

Confirm that Picom's Electron renderer uses Supabase Auth safely and that authenticated data access is constrained by RLS policies.

## Static check

Run:

```powershell
node scripts/auth-rls-integration-check.mjs
```

The script checks that required Auth/RLS files exist and scans key files for obvious sensitive snippets such as service-role key references or password logging patterns.

## Manual integration test flow

1. Start local Supabase.
2. Apply migrations and seed data.
3. Generate fresh database types if Supabase CLI is available.
4. Start Picom in Electron dev mode.
5. Register a new user.
6. Confirm a profile row is created by the auth/profile trigger.
7. Log out.
8. Log back in with the same user.
9. Confirm the desktop app loads only communities visible to that user.
10. Run member-only community access verification.
11. Run private channel boundary verification.
12. Expire or remove the session in Supabase Auth and confirm the app returns to a safe signed-out state.

## Expected results

- The desktop app never logs passwords, tokens, or authorization headers.
- The desktop renderer uses the anon key only.
- Authenticated users can read only RLS-permitted data.
- Non-members cannot read community, channel, message, attachment, or reaction data for unrelated communities.
- Expired sessions are recoverable through the login screen.

## Commands

```powershell
npm run supabase:smoke
node scripts/auth-rls-integration-check.mjs
npm run typecheck
npm run build
```

## Security notes

Do not run this test with production credentials. Use local or staging-only accounts.

Privileged operations must use trusted server-side code or Supabase Edge Functions later; the Electron renderer must never receive a service-role key.