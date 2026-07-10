# Task 129 - Feature Flags Production

## Result

Completed. Screen share and admin operations now have typed flags, the requested production feature map is centralized, risky feature fallbacks are disabled, voice remains available, and runtime override source attribution is accurate. Remote config remains allowlisted and fail-safe.

## Changed files

- `src/services/featureFlagService.ts`
- `scripts/feature-flags-smoke-test.mjs`
- `docs/config/feature-flags-production.md`
- `docs/task-checkpoints/task-129-feature-flags-production.md`

## Verification

- `npm run feature-flags:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

Feature flags remain availability controls only. Backend permissions, RLS, native IPC checks, and service-specific kill switches are unchanged and still required.
