# Task 174 checkpoint: Bot system MVP production

## Result

- Confirmed bot profiles are visibly marked in member/message UI and Community Settings > Bots exists.
- Preserved normal role-based community installations with no implicit bot administrator access.
- Added owner/app-admin plus community-manager-gated one-time credential issue/revoke/status RPCs.
- Raw token is returned once; only hash/prefix/lifecycle metadata is stored in a backend-only table.
- Added backend-only atomic per-credential/action rate-limit counters and service-role-only function.
- Added append-only credential lifecycle audit events.
- Kept public Bot API, marketplace, provisioning UI, plugin runtime, arbitrary code and renderer secrets disabled.

## Validation

- `npm run bots:production:test`
- `npm run bot-api:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining blockers

- Supabase CLI is unavailable locally, so live RPC/RLS/rate-limit tests remain required.
- Trusted provisioning, UI-to-RPC wiring, gateway authentication/authorization, role/channel behavior tests, rotation, abuse handling, observability and security review remain required before external bots are enabled.
