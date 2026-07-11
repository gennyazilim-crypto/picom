# Task 460 checkpoint: friendship schema, RLS, and privacy foundation

## Result

Completed the canonical friendship lifecycle without merging it with the existing one-way Follow model.

- Added `pending`, `accepted`, `declined`, and `cancelled` request states.
- Added symmetric pending-request uniqueness and transaction-level race serialization.
- Preserved terminal request history while retaining the existing RPC API.
- Enforced participant-only RLS reads and RPC-only authenticated mutations.
- Kept normalized symmetric friendships separate from `user_follows`.
- Enforced bilateral block checks for friend requests and mock/new DM conversations.
- Aligned TypeScript, generated database types, mock state, and service transitions.
- Added deterministic schema/RLS/privacy smoke coverage and pgTAP contract coverage.

## Validation

Passed:

- `npm run friendship:foundation:smoke`
- `npm run friends:production:smoke`
- `npm run blocking:privacy:smoke`
- `npm run dm:production:smoke`
- `npm run supabase:smoke`
- `npm run supabase:rls:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Performance remained inside hard gates:

- initial JS: 1526.3 KiB / 1650.0 KiB hard cap
- initial CSS: 227.3 KiB / 240.0 KiB hard cap
- total assets: 2976.0 KiB / 3500.0 KiB hard cap

## External evidence

The Supabase CLI is not installed in this environment. Static migration and RLS checks passed, but live pgTAP execution against an isolated Supabase database is **BLOCKED**, not reported as passed. Run `npm run supabase:rls:test` after installing/configuring the Supabase CLI.

## Safety notes

- No product UI was changed.
- No secret or production credential was used.
- Existing community chat, Follow, block, and DM service boundaries remain intact.
- Existing applied migrations were not rewritten; the change is forward-only.
