# Task 139 checkpoint - Document RLS policies

## Completed

- Added a centralized RLS policy reference document.
- Summarized helper functions, table policies, private channel behavior, and verification docs.
- Updated the Supabase database guide to point to the active RLS policy matrix.
- Kept this task documentation-only with no runtime UI changes.

## Changed files

- `docs/rls-policies.md`
- `docs/supabase-database.md`
- `docs/task-checkpoints/task-139-document-rls-policies.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

Storage bucket RLS/policies remain a future task and are explicitly called out in the policy docs.