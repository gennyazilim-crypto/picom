# Task 121 checkpoint - Supabase schema smoke test

## Completed

- Added cross-platform Node smoke test script.
- Added `npm run supabase:smoke` package script.
- Documented safe default behavior and optional local `--reset` mode.

## Changed files

- `package.json`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/supabase-schema-smoke-test.md`
- `docs/task-checkpoints/task-121-supabase-schema-smoke-test.md`

## Verification

- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

The default smoke test is non-destructive. Full `supabase db reset` requires an explicit `--reset` flag.