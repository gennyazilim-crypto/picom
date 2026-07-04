# Task 143 checkpoint - Community service

## Completed

- Added `communityService` with `listCommunities()` and `createCommunity()`.
- Added `CommunitySummary` DTO and service-level result/error types.
- Preserved deterministic mock behavior.
- Wired Supabase mode through `dataSourceService`, Supabase Auth, and RLS.
- Documented service behavior and manual tests.

## Changed files

- `src/services/communityService.ts`
- `docs/community-service.md`
- `docs/task-checkpoints/task-143-community-service.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

This service intentionally returns summary records only. Channel/member/message loading belongs to follow-up service tasks.