# Task 136 checkpoint - Reactions RLS policy

## Completed

- Added select/insert/delete RLS policies for `public.message_reactions`.
- Connected reaction reads to message visibility through `public.can_view_message()`.
- Limited reaction creation and removal to the authenticated user's own rows.
- Left update intentionally unavailable for immutable reaction rows.
- Updated smoke test migration checklist.
- Documented policy behavior and manual test steps.

## Changed files

- `supabase/migrations/20260704002100_reactions_rls.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/reactions-rls-policy.md`
- `docs/task-checkpoints/task-136-reactions-rls-policy.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

Reaction RLS now prevents private message metadata leakage through reaction queries.