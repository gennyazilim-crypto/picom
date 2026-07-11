# Task 436 - Existing Community Backfill to Text Kind

Status: COMPLETE WITH LOCAL DATABASE EXECUTION BLOCKED

## Outcome

- Added an idempotent null-only backfill migration for legacy communities.
- Made existing seed and primary mock communities explicitly `text`.
- Preserved separate typed examples for Text, Radio, and Podcast behavior.
- Added a narrow missing-column rollout fallback for legacy list and Text create requests.
- Prevented Radio/Podcast navigation from selecting a real text channel through shared state.
- Documented pre/post integrity counts, role access matrix, rollback limitations, and forward-fix steps.

## Task files

- `supabase/seed.sql`
- `supabase/migrations/20260711000200_existing_communities_text_backfill.sql`
- `src/data/mockCommunities.ts`
- `src/services/communityListQuery.ts`
- `src/services/communityService.ts`
- `src/state/useMvpAppState.ts`
- `scripts/community-kind-backfill-smoke.mjs`
- `scripts/community-kind-domain-smoke.mjs`
- `docs/community-kind-backfill-runbook.md`
- `docs/task-checkpoints/task-436-existing_community_backfill_to_text_kind.md`
- `package.json`

## Safety

- Backfill changes only `kind is null` rows.
- Explicit Radio/Podcast values are never overwritten.
- No channel, message, member, role, invite, owner, or audit row is modified.
- Fallback accepts only a proven missing-column error and only treats legacy data as Text.

## Commands and results

- `npm ci` - PASS, 0 vulnerabilities.
- `npm run community:kind:smoke` - PASS.
- `npm run community:kind:backfill:smoke` - PASS.
- `npm run mock:smoke` - PASS.
- `npm run supabase:smoke` - PASS.
- `npm run supabase:api-regression` - PASS.
- `npm run supabase:rls:smoke` - PASS for structural checks; pgTAP execution skipped.
- `npm run community:access:smoke` - PASS for owner/admin/moderator/member/visitor scenarios.
- `npm run typecheck` - PASS.
- `npm run build` - PASS.
- `npm run qa:smoke` - PASS.
- `npm run performance:budget:ci` - PASS.

Validation ran in a detached clean worktree based on commit `ba9d0e3` with only Task 436 files overlaid. User-owned Iconix/AppIcon and release output were excluded.

Performance remained within hard limits: 2,764.7 KiB total assets, 1,403.5 KiB largest JS chunk, 216.2 KiB largest CSS chunk, and 29 generated assets.

## Blocked checks

- Supabase CLI is unavailable, so the migration could not be applied twice against a disposable local database.
- Real pgTAP RLS execution is blocked by the same missing CLI. Run `npm run supabase:rls:test` after installing it.
- No hosted database credentials were used and no hosted migration result is claimed.
