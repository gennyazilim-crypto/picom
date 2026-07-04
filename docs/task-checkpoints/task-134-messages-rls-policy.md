# Task 134 checkpoint - Messages RLS policy

## Completed

- Added `public.can_send_message_to_channel(target_channel_id uuid)` helper.
- Added select/insert/update/delete RLS policies for `public.messages`.
- Connected message reads to channel visibility through `public.can_view_channel()`.
- Limited message inserts to the authenticated user as author and text channels only.
- Updated smoke test migration checklist.
- Documented security behavior and manual test steps.

## Changed files

- `supabase/migrations/20260704001900_messages_rls.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/messages-rls-policy.md`
- `docs/task-checkpoints/task-134-messages-rls-policy.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

Message access now follows channel access. Moderator-specific message deletion can be added later through role-aware permission helpers without weakening the current MVP policy.