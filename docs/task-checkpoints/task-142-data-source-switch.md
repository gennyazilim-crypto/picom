# Task 142 checkpoint - Data source switch mock vs Supabase

## Completed

- Added `dataSourceService` as the central data source mode resolver.
- Wired `supabaseClient` to use the central data source status.
- Wired `authService` to use the central data source status for mock vs Supabase behavior.
- Documented the mock/Supabase mode contract and test steps.

## Changed files

- `src/services/dataSourceService.ts`
- `src/services/supabase/supabaseClient.ts`
- `src/services/authService.ts`
- `docs/data-source-switch.md`
- `docs/task-checkpoints/task-142-data-source-switch.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

This task establishes the service boundary only. Full community/channel/message CRUD loading in Supabase mode belongs to the following data service tasks.