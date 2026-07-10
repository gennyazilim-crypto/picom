# Task 080 Checkpoint: RLS Regression Test Suite

## Result

- Expanded the RLS smoke runner to include Direct Message pgTAP tests.
- Added required DM outsider, Mention Feed privacy, Profile activity/media privacy, and MVP+ hardening evidence checks.
- Documented the complete actor/operation matrix and exact local/staging commands.
- Preserved production safety; no database connection or migration was performed.

## Test status

- Structural RLS smoke: executed.
- Real pgTAP: skipped because Supabase CLI is unavailable.

## Checks

- `npm run supabase:rls:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
