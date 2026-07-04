# Task 118 checkpoint - Supabase seed data

## Completed

- Added deterministic Supabase local seed data.
- Seed includes auth users, profiles, communities, roles, members, categories, text/voice channels, messages, attachment metadata, reactions, and read states.
- Documented development credentials and local reset workflow.

## Changed files

- `supabase/seed.sql`
- `docs/supabase-seed-data.md`
- `docs/task-checkpoints/task-118-supabase-seed-data.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

The seed is intended for local Supabase development only. No production secrets were added.