# Task 198 - Create invite acceptance Edge Function placeholder

## Scope

- Added `accept-invite` Supabase Edge Function placeholder.
- Added JWT verification config for the function.
- Documented why the function returns a clear not-implemented response until invite schema/atomic acceptance exists.

## Runtime impact

- Existing desktop UI behavior is unchanged.
- No secrets or service-role credentials were added.

## Verification

- Run `npm run supabase:smoke`.
- When Supabase CLI is available, serve `accept-invite` and confirm it returns `INVITE_ACCEPTANCE_NOT_IMPLEMENTED` for a valid-looking invite code.
