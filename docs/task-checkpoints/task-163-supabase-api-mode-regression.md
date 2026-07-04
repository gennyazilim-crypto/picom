# Task 163 Checkpoint: Supabase API mode regression test

## Completed

- Added `scripts/supabase-api-mode-regression.mjs`.
- Added `npm run supabase:api-regression`.
- Documented API-mode regression coverage, env requirements, RLS notes, and manual verification steps.

## Changed files

- `package.json`
- `scripts/supabase-api-mode-regression.mjs`
- `docs/supabase-api-mode-regression.md`
- `docs/task-checkpoints/task-163-supabase-api-mode-regression.md`

## Verification

Run:

```bash
npm run supabase:api-regression
npm run supabase:smoke
npm run typecheck
npm run build
```