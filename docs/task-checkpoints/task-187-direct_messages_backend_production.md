# Task 187: Direct messages backend production

## Completed

- Added Supabase conversation/message loading and renderer integration.
- Enforced exactly two participants and no group DM.
- Applied block and recipient privacy controls on create/send.
- Added idempotent RPC sends, read markers, realtime membership verification, and cleanup.
- Added access-boundary smoke coverage.

## Verification

- `npm run dm:production:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
