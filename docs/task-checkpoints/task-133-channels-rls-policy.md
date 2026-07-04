# Task 133 checkpoint - Channels RLS policy

## Completed

- Added `public.can_view_channel(target_channel_id uuid)` helper.
- Added select/insert/update/delete RLS policies for `public.channels`.
- Limited private channel reads to community owners for the MVP.
- Updated smoke test migration checklist.
- Documented policy behavior and manual test steps.

## Changed files

- `supabase/migrations/20260704001800_channels_rls.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/channels-rls-policy.md`
- `docs/task-checkpoints/task-133-channels-rls-policy.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

Role-based private channel visibility is intentionally deferred. The current MVP policy is conservative and keeps private channels owner-only until role/channel permission tasks expand it safely.