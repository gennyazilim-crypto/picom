# Task 116 checkpoint - Read states table schema

## Completed

- Added read-state lookup indexes.
- Added trigger to prevent read markers from pointing at messages in another channel.
- Documented privacy/RLS implications and manual Supabase verification steps.

## Changed files

- `supabase/migrations/20260704001100_read_states_schema.sql`
- `docs/read-states-table-schema.md`
- `docs/task-checkpoints/task-116-read-states-schema.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

This task only affects Supabase schema and documentation. Existing MVP desktop UI behavior remains unchanged.