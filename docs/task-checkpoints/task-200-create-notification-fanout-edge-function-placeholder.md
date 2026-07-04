# Task 200 - Create notification fanout Edge Function placeholder

## Scope

- Added `notification-fanout` Supabase Edge Function placeholder.
- Added JWT verification config for the function.
- Documented supported placeholder event types and future delivery rules.

## Runtime impact

- Existing desktop UI behavior is unchanged.
- No push provider, secrets, or real fanout side effects were added.

## Verification

- Run `npm run supabase:smoke`.
- When Supabase CLI is available, serve `notification-fanout` and confirm it returns `NOTIFICATION_FANOUT_NOT_IMPLEMENTED` for a valid-looking request.
