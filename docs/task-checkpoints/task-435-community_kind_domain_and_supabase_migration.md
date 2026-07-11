# Task 435 - Community Kind Domain and Supabase Migration

Status: COMPLETE WITH HOSTED DATABASE VALIDATION BLOCKED

## Outcome

- Added canonical `text`, `radio`, and `podcast` community kinds.
- Added strict capability helpers that prevent treating Radio/Podcast as text-channel products.
- Added non-destructive PostgreSQL enum migration with existing-row backfill and invalid-value rejection.
- Extended app, shared DTO, mock, Supabase query/service, and generated database types.
- Kept existing ownership, membership, role, invite, visibility, and RLS boundaries unchanged.

## Task files

- `src/types/community.ts`
- `src/data/mockCommunities.ts`
- `src/services/communityService.ts`
- `src/services/communityListQuery.ts`
- `src/services/supabase/database.types.ts`
- `packages/shared/src/dto/community.ts`
- `supabase/migrations/20260711000100_community_kind_domain.sql`
- `scripts/community-kind-domain-smoke.mjs`
- `docs/community-kind-schema-rls.md`
- `docs/task-checkpoints/task-435-community_kind_domain_and_supabase_migration.md`
- `package.json`

## Security notes

- Invalid kinds fail in service validation and at the PostgreSQL enum boundary.
- The migration performs no delete, truncate, or destructive rewrite.
- Existing rows become `text`; unknown pre-existing values block migration rather than being silently changed.
- Kind is not an authorization claim and does not bypass RLS.

## Commands and results

- `npm ci` - PASS, 0 vulnerabilities.
- `npm run community:kind:smoke` - PASS.
- `npm run shared:types:check` - PASS.
- `npm run shared:types:smoke` - PASS.
- `npm run mock:smoke` - PASS.
- `npm run supabase:smoke` - PASS.
- `npm run supabase:api-regression` - PASS.
- `npm run supabase:rls:smoke` - PASS for structural RLS checks; real pgTAP execution skipped.
- `npm run community:access:smoke` - PASS.
- `npm run audio:mvp:qa` - PASS.
- `npm run typecheck` - PASS.
- `npm run build` - PASS.
- `npm run qa:smoke` - PASS.
- `npm run performance:budget:ci` - PASS.

Validation ran in a detached clean worktree based on commit `c963c8c` with only Task 435 files overlaid. User-owned Iconix/AppIcon and release output were excluded.

Performance remained within hard limits: 2,763.7 KiB total assets, 1,402.7 KiB largest JS chunk, 216.2 KiB largest CSS chunk, and 29 generated assets.

## Blocked checks and follow-up

- Supabase CLI is unavailable on this host, so applying the migration to a disposable local Postgres instance is BLOCKED.
- Real pgTAP RLS execution is BLOCKED for the same reason; only the repository's structural RLS smoke ran.
- After installing the Supabase CLI, run `npm run supabase:rls:test` against a disposable local stack before hosted promotion.
