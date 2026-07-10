# Task 122 Checkpoint: Data Residency Plan

## Result

Documented Picom's current single-project limitation and a gated future regional-cell strategy for Supabase, Storage, LiveKit, backups, and enterprise tenants. No runtime, schema, routing, or provider configuration changed.

## Confirmed limitations

- No approved production Supabase/Storage/LiveKit region is recorded in the repository.
- No multi-region routing or client region selection exists.
- Database backups do not replace Storage object backup/restore.
- LiveKit media/signaling residency requires a separate provider/pinning decision.
- No residency/compliance guarantee can be made from current configuration.

## Planned path

- Approve one primary region first.
- Record provider, backup, Storage, LiveKit, support/log, legal, and subprocessor evidence.
- Use independent regional cells only after Organization/Workspace tenancy exists.
- Assign one immutable home region/write authority per tenant/community.
- Require full Auth/Storage/RLS/realtime/voice migration and rollback drills.

## Validation

- Documentation-only; existing Picom behavior is unchanged.
- `npm run typecheck`
- `npm run mock:smoke`

