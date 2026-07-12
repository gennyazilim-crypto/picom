# Task 618 Checkpoint: Production Data Source and Mock Fallback Removal

## Result

Picom now has one authoritative data-source decision from release configuration through startup and service status. Stable/production cannot select mock mode, and invalid Supabase configuration blocks before `App` mounts.

## Audit findings

- Existing mock fixture exports were already protected by `selectMockFixture` and become empty outside explicit mock mode.
- Included V1 services already route Supabase access through service/repository layers.
- `appConfig` previously defaulted unknown values to mock while `dataSourceService` independently defaulted them to blocked Supabase. This split authority could produce inconsistent metadata and behavior.
- Explicit `mock` was previously accepted even when environment/channel identified a stable production build.
- Missing Supabase configuration returned service errors but did not stop the renderer before application state initialized.
- Mention Feed contained a component-level mock/Supabase branch for query flags.

## Changes

- Moved `DataSourceMode` and release-aware resolution into `dataSourcePolicy`.
- Made `appConfig` store the single decision, explicitness, and safe error.
- Made `dataSourceService` consume that decision rather than resolving again.
- Added a pre-App production configuration gate and recoverable error screen.
- Removed the Mention Feed component-level data-source branch.
- Extended the existing no-silent-fallback smoke and added a V1 startup contract.
- Documented renderer-safe public configuration and secret boundaries.

## Release truth

This task proves local configuration enforcement only. It does not prove that the hosted Supabase project, RLS, Storage, Realtime, or Edge Functions are deployed and correct. Task 619 and later evidence tasks remain blockers.

## Validation

- `node scripts/data-source-final-cleanup-smoke.mjs`: PASS
- `node scripts/v1-production-data-source-smoke.mjs`: PASS
- `node scripts/validate-supabase-environment.mjs`: PASS for local, staging, production examples and secret boundary
- `npm ci`: PASS, 0 vulnerabilities
- `npm run typecheck`: PASS
- `npm run build`: PASS

The build retained the existing large-chunk warning; no performance limit or quality gate was weakened.

## Preserved work

No user/Cursor files, real environment values, release outputs, Iconix work, or local credentials are included. Mock mode remains available for explicit local development and deterministic tests.
