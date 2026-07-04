# Task 108 checkpoint - Communities table schema

## Completed

- Added Supabase SQL migration for communities table validation constraints.
- Added owner and created-at indexes for common community lookup paths.
- Documented field purpose, validation rules, RLS implications, and manual verification steps.

## Changed files

- `supabase/migrations/20260704000300_communities_schema.sql`
- `docs/communities-table-schema.md`
- `docs/task-checkpoints/task-108-communities-schema.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

The baseline migration already creates `public.communities`; this task safely hardens that table without changing desktop UI behavior.