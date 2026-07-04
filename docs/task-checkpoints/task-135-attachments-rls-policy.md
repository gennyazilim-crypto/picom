# Task 135 checkpoint - Attachments RLS policy

## Completed

- Added `public.can_view_message(target_message_id uuid)` helper.
- Added `public.can_attach_file_to_message(target_message_id uuid)` helper.
- Added select/insert/update/delete RLS policies for `public.attachments`.
- Recreated `public.message_attachments` with `security_invoker = true`.
- Updated smoke test migration checklist.
- Documented policy behavior, security implications, and manual test steps.

## Changed files

- `supabase/migrations/20260704002000_attachments_rls.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/attachments-rls-policy.md`
- `docs/task-checkpoints/task-135-attachments-rls-policy.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

Storage bucket policies are intentionally deferred until Supabase Storage bucket tasks. This task protects attachment metadata in Postgres.