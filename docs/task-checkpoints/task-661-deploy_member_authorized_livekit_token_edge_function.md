# Task 661 checkpoint: deploy member-authorized LiveKit token Edge Function

## Implemented

- Restricted deployment to Supabase project `picom-staging` (`ufmtvqtsklqsmqxefbbs`).
- Added a protected, manual-only GitHub workflow using the `hosted-staging` environment.
- Added ordered hosted migration reconciliation: only migration-history gaps are applied and recorded before Task 660 RPC verification and Function deployment; replayed RLS policies are replaced transactionally, `storage.objects` DDL runs under its canonical `supabase_storage_admin` owner, and an existing wholly untracked schema fails closed.
- Kept Supabase JWT verification, canonical profile identity, exact CORS, bounded JSON, deterministic room name, 600-second TTL, no-store responses, and a 10-per-60-second per-user rate limit.
- Preserved intent-scoped least privilege: Voice publishes microphone; Screen publishes microphone, screen share, and screen-share audio; both subscribe; camera/data remain denied.
- Added temporary hosted fixtures for Owner, Admin, Moderator, Member, roleless Member, Visitor, non-member, banned member, and rate-limit isolation.
- Added cleanup for all synthetic community and Auth data.
- Added a redacted artifact contract; no secret, JWT, fixture credential/email, or raw fixture ID is emitted.

## Required real evidence

Task 661 is complete only when the protected `Picom LiveKit Token Staging` workflow finishes successfully with input `STAGING_ONLY` and uploads artifact `task-661-livekit-token-staging-evidence` whose status is `passed`. Provider/native connection evidence remains in later tasks and is not inferred from token shape.

## Validation commands

- `npm run livekit:token:security:smoke`
- `npm run livekit:token:deploy:staging`
- `npm run supabase:migrations:check`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

The protected hosted workflow additionally runs `npm run livekit:token:deploy:staging -- --apply` and `node scripts/livekit-token-member-hosted-fixture.mjs`.
