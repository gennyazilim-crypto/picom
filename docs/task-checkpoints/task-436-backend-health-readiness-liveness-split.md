# Task 436 Checkpoint: Backend Health/Readiness/Liveness Split

## Summary

Split Picom's public Supabase `health` Edge Function into liveness, readiness, and combined summary behavior while preserving backward compatibility for existing desktop health checks.

## Scope

- Added route handling for `/health`, `/health/live`, and `/health/ready`.
- Kept `/health` compatible with existing maintenance/network status services.
- Added readiness dependency placeholders for database, Redis, storage, and realtime.
- Made readiness return `503` when a required dependency is unavailable or degraded.
- Added backend deployment health documentation.
- Added a smoke test for route/documentation coverage.

## Files changed

- `supabase/functions/health/index.ts`
- `docs/deployment-backend.md`
- `docs/edge-functions.md`
- `supabase/functions/README.md`
- `scripts/backend-health-split-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-436-backend-health-readiness-liveness-split.md`

## Validation

- `npm run backend:health:smoke`
- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- Health responses remain public and non-sensitive.
- Real dependency probes are documented as production hardening TODOs.
- No desktop UI redesign, mobile UI, or unrelated feature work was added.

