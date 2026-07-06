# Task 437 Checkpoint: Backend Graceful Degradation

## Summary

Prepared Picom's backend graceful degradation policy and updated the health summary to distinguish required dependency readiness from optional dependency degradation.

## Scope

- Documented critical vs optional backend services.
- Documented degraded behavior for Storage, Realtime, LiveKit, Redis, email, analytics, and auto-update.
- Updated `/health` combined summary to report degraded optional dependencies without failing readiness.
- Kept `/health/ready` focused on required dependency readiness.
- Added a smoke test for graceful degradation coverage.

## Files changed

- `docs/backend-graceful-degradation.md`
- `docs/deployment-backend.md`
- `supabase/functions/health/index.ts`
- `scripts/backend-graceful-degradation-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-437-backend-graceful-degradation.md`

## Validation

- `npm run backend:degradation:smoke`
- `npm run backend:health:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- This task does not add a new backend server.
- Optional service degradation remains public and non-sensitive.
- No desktop UI redesign, mobile UI, or unrelated feature work was added.

