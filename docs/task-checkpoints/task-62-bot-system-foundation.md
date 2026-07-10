# Task 62 - Bot System Foundation

- Added `profiles.is_bot`, token-free bot ownership records, and role-based community installations.
- Added Community Admin Panel > Bots with installed mock bots, safe add placeholder, and explicit remove confirmation.
- Added BOT badges to member and message rows.
- Kept bot creation disabled in Supabase mode until a trusted server function exists.
- Added no public Bot API, marketplace, plugin runtime, dynamic code loading, or raw token field/display.
- Bot permissions remain the assigned community role plus Supabase RLS.

Validation: `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
