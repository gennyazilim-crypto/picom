# Task 109 checkpoint - Community members table schema

## Completed

- Added a role lookup index for community membership records.
- Added a database trigger that prevents cross-community role assignment.
- Documented membership table purpose, RLS implications, and manual Supabase test steps.

## Changed files

- `supabase/migrations/20260704000400_community_members_schema.sql`
- `docs/community-members-table-schema.md`
- `docs/task-checkpoints/task-109-community-members-schema.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

This task does not change the desktop UI. It prepares safer Supabase membership data for future API/RLS integration.