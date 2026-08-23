# PRODUCTION ROLLBACK PLAN — PICOM Paid Platform (TASK 07)

## Principles

- Prefer **feature flag / kill switch** rollback over schema rollback.
- Never delete financial ledger, payout approvals, or audit rows to “undo.”
- Never run automatic destructive down migrations on production.
- Forward-fix migrations for schema defects.

## Web rollback

1. Redeploy previous known-good web artifact hash from release inventory.
2. Confirm `production-config-guard` still passes (no staging target).
3. Invalidate CDN/cache if used.

## Account Center rollback

1. Redeploy previous Account Center artifact.
2. Verify auth callback URLs remain production allowlisted.

## Edge Function rollback

1. Redeploy previous function version recorded in release manifest `rollbackVersion`.
2. Keep webhook secrets rotated only with dual control; do not log values.

## Worker rollback

1. Stop new deploys; scale processing consumers to 0.
2. Redeploy previous **immutable digest** (not `:latest`).
3. Drain leases; inspect dead-letter; do not re-drive payouts automatically.

## Feature flag shutdown

Set server-side:

- `advertising_global_enabled=false`
- campaign submission/activation false
- verified checkout/identity false
- business application/publish false
- creator/publisher monetization false
- payout onboarding/batch processing false
- `real_payouts_enabled=false`

## Advertising global kill switch

Engage `advertising_global_kill_switch` (or equivalent ads setting) so resolve/delivery fail closed.

## Payout global kill switch

Engage `global_payouts_kill_switch` / disable batch processing. Leaves ledger intact.

## Migration rollback boundaries

| Situation | Action |
| --- | --- |
| Failed migration mid-transaction | Abort; leave DB at last successful version; open incident |
| Successful migration with app bug | Forward-fix SQL + flags off |
| Data corruption suspicion | PITR restore to pre-change point **only** with finance+SRE approval; reconcile ledgers after |

## Restore criteria

- PITR/backup gate previously PASS
- Restore target is isolated until integrity checks PASS
- Row-count + invariant checks documented

## Data reconciliation

After any rollback/restore:

- subscription vs entitlement
- campaign spend vs ledger
- payout batch vs provider
- transparency archive continuity

## Communication

Status page + internal incident channel. No secret/project credential disclosure.

## Incident ownership

| Area | Owner |
| --- | --- |
| Platform/DB | platform-sre |
| Billing | billing |
| Ads delivery | ads |
| Payouts | finance |
| Legal exposure | legal + security |
