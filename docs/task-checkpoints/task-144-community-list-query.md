# Task 144 checkpoint - Community list query

## Completed

- Added `communityListQuery` module.
- Extracted mock community summary mapping.
- Extracted Supabase community list select/mapping.
- Updated `communityService.listCommunities()` to use the query module.
- Reused the same select shape for create-community return mapping.

## Changed files

- `src/services/communityListQuery.ts`
- `src/services/communityService.ts`
- `docs/community-list-query.md`
- `docs/task-checkpoints/task-144-community-list-query.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

The query intentionally returns community summaries only. Full nested community hydration remains a follow-up task.