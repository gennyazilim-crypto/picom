# Task 117 checkpoint - Chat query indexes

## Completed

- Added targeted indexes for message pagination, channel switching, member sidebar grouping, unread lookup, and attachment loading.
- Documented indexed query paths, RLS implications, and manual verification steps.

## Changed files

- `supabase/migrations/20260704001200_chat_query_indexes.sql`
- `docs/chat-query-indexes.md`
- `docs/task-checkpoints/task-117-chat-query-indexes.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

This task only affects Supabase schema/indexes and documentation. Existing MVP desktop UI behavior remains unchanged.