# Task 279 checkpoint: community invite acceptance production

## Completed

- Added an atomic v2 invite acceptance RPC with stable error codes.
- Enforced validation, expiry, revocation, max uses, bans, default role, and idempotent existing membership.
- Added race-safe membership insert and transaction-local use/audit updates.
- Added safe frontend error mapping and explicit `joined`/`already_member` UX.
- Kept mock mode aligned and preserved the v1 RPC for compatibility.

## Verification

- `npm run invites:acceptance:production:test`
- `npm run invites:campaigns:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining environment check

Apply the migration and run concurrent acceptance, active-ban, revoked, expired, exhausted, default-role-missing, and repeat-member tests against Supabase. No hosted/CLI pass is claimed here.
