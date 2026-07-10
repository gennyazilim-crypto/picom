# Task 280 checkpoint: join community public flow production

## Completed

- Added an atomic and idempotent public join RPC.
- Enforced authentication, public visibility, active bans, and default Member role.
- Kept private communities on the invite/approval path in both service and modal UX.
- Updated App/Discovery state from typed `joined`/`already_member` outcomes.
- Preserved visitor read-only filtering and composer permission enforcement.
- Added redacted membership audit metadata and a static production test.

## Verification

- `npm run community:public-join:production:test`
- `npm run community:access:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining environment check

Apply the migration and test authenticated public join, anonymous rejection, private rejection, active ban, repeat join, missing default role, and concurrent join against Supabase. No hosted/CLI pass is claimed here.
