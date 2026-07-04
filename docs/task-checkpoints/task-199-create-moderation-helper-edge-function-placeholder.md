# Task 199 - Create moderation helper Edge Function placeholder

## Scope

- Added `moderation-helper` Supabase Edge Function placeholder.
- Added JWT verification config for the function.
- Documented accepted action types, future permission checks, and safe not-implemented behavior.

## Runtime impact

- Existing desktop UI behavior is unchanged.
- No secrets, service-role credentials, or moderation side effects were added.

## Verification

- Run `npm run supabase:smoke`.
- When Supabase CLI is available, serve `moderation-helper` and confirm it returns `MODERATION_HELPER_NOT_IMPLEMENTED` for a valid-looking request.
