# Task 114 checkpoint - Message attachments table schema

## Completed

- Hardened the existing `public.attachments` table for message attachment usage.
- Added thumbnail URL and upload lifecycle status fields.
- Added validation constraints and attachment lookup indexes.
- Added `public.message_attachments` view to align with task naming without renaming the baseline table.
- Documented RLS/security implications and manual Supabase verification steps.

## Changed files

- `supabase/migrations/20260704000900_message_attachments_schema.sql`
- `docs/message-attachments-table-schema.md`
- `docs/task-checkpoints/task-114-message-attachments-schema.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

This task only affects Supabase schema and documentation. Existing MVP desktop UI behavior remains unchanged.