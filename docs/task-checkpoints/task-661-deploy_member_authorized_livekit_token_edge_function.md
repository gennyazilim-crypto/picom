# Task 661 checkpoint: deploy member-authorized LiveKit token Edge Function

## Implemented

- Restricted deployment to Supabase project `picom-staging` (`ufmtvqtsklqsmqxefbbs`).
- Added a protected, manual-only GitHub workflow using the `hosted-staging` environment.
- Added ordered hosted migration reconciliation: only migration-history gaps are applied and recorded before Task 660 RPC verification and Function deployment; replayed public RLS policies are replaced transactionally, while owner-only `storage.objects` DDL is omitted only after its policy names and RLS state are verified remotely. Migrations needing missing Storage-owner policies are deferred whole and left unrecorded; unsafe drop-only state and wholly untracked schemas fail closed.
- Kept Supabase JWT verification, canonical profile identity, exact CORS, bounded JSON, deterministic room name, 600-second TTL, no-store responses, and a 10-per-60-second per-user rate limit.
- Preserved intent-scoped least privilege: Voice publishes microphone; Screen publishes microphone, screen share, and screen-share audio; both subscribe; camera/data remain denied.
- Added temporary hosted fixtures for Owner, Admin, Moderator, Member, roleless Member, Visitor, non-member, banned member, and rate-limit isolation.
- Added cleanup for all synthetic community and Auth data.
- Added a redacted artifact contract; no secret, JWT, fixture credential/email, or raw fixture ID is emitted.

## Required real evidence

Task 661 is complete only when the protected `Picom LiveKit Token Staging` workflow finishes successfully with input `STAGING_ONLY` and uploads artifact `task-661-livekit-token-staging-evidence` whose status is `passed`. Provider/native connection evidence remains in later tasks and is not inferred from token shape.

Any `deferredOwnerMigrations` entries in the artifact remain release blockers for the full schema-sync gate even when this Voice-token task passes.
Mixed schema/Storage migration `20260711149900` was split so its ordinary schema and RPC contract can apply independently; owner-only branding Storage policy DDL remains explicit in `20260712166100` and must not be marked applied by this workflow when policies are absent.
The protected workflow now requires applied Voice prerequisite `20260711150600` plus its canonical room/public-channel RPCs and executes only reviewed active-member target `20260712166000`; every other pending migration is reported as `outOfScopePendingMigrations` rather than becoming an unrelated Task 661 side effect.
Forward migration `20260712166200` reconciles staging environments that recorded an older rate-limit function/constraint: it preserves all known message and Meeting action keys while enforcing `livekit_token` at ten requests per sixty seconds.
Forward migration `20260712166300` replaces the limiter with an unambiguous `observed_at timestamptz` variable because PostgreSQL interpreted the historical `current_time` identifier as the `CURRENT_TIME` keyword (`timetz`).
Forward migration `20260712166400` replaces `authorize_livekit_room` with fully qualified channel references because its `RETURNS TABLE community_id` output variable made the historical unqualified `community_id` predicate ambiguous (`42702`) on hosted PostgreSQL.
Hosted run `29194734946` proved the migration and Function deployment, then exposed that Function-internal method/body/CORS fixture requests lacked JWTs and were correctly rejected by the Supabase gateway before reaching those checks. The fixture now supplies an active Owner JWT for those three contract probes while retaining a separate unauthenticated denial probe.

## Validation commands

- `npm run livekit:token:security:smoke`
- `npm run livekit:token:deploy:staging`
- `npm run supabase:migrations:check`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

The protected hosted workflow additionally runs `npm run livekit:token:deploy:staging -- --apply` and `node scripts/livekit-token-member-hosted-fixture.mjs`.
