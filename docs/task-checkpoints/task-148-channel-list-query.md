# Task 148 checkpoint - Channel list query

## Completed

- Added `channelListQuery` module.
- Extracted mock channel summary mapping.
- Extracted Supabase channel list select/mapping.
- Updated `channelService.listChannels()` to use the query module.
- Reused the same select shape for create-channel return mapping.

## Changed files

- `src/services/channelListQuery.ts`
- `src/services/channelService.ts`
- `docs/channel-list-query.md`
- `docs/task-checkpoints/task-148-channel-list-query.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

The query intentionally returns channel summaries only. Category/sidebar hydration remains in follow-up tasks.