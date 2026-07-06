# Task Checkpoint: Supabase RLS Real Tests

## Status

Completed.

## What changed

- Added pgTAP-shaped RLS SQL tests under `supabase/tests/rls`.
- Added `scripts/supabase-rls-smoke.mjs`.
- Added `npm run supabase:rls:smoke`.
- Added `npm run supabase:rls:test`.
- Included the structural RLS smoke in `npm run qa:supabase`.
- Documented setup, commands, CLI-missing behavior, and storage/RLS boundaries in `docs/supabase-rls-test-plan.md`.

## CLI result

Supabase CLI was not available in this environment, so real pgTAP execution was not run. The new smoke command validates the test files and prints an explicit warning instead of faking a live RLS pass.

## Commands run

- `npm run supabase:rls:smoke`
- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Follow-up when Supabase CLI is installed

```powershell
supabase start
supabase db reset
npm run supabase:rls:test
```
