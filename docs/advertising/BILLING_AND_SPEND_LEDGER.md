# Billing and spend ledger

## Funding

Provider-neutral tables: `advertiser_funding_accounts`, `advertiser_funding_transactions`. No fake funded state without provider settlement.

## Reservation

`reserve_campaign_budget` locks available balance and creates append-only reservation + funding transaction. Duplicate idempotency keys return the existing reservation.

## Spend ledger

`ad_spend_ledger` is append-only (`ADS_APPEND_ONLY`). Charges are idempotent. Reversals insert new rows (`invalid_traffic_reversal`). Clients cannot insert/update/delete.

## Invariants

- `cash + credit = gross`
- `consumed_amount_minor <= amount_minor`
- lifetime/reservation overspend blocked (`BUDGET_EXHAUSTED`)
- currency mismatch blocked

## Provider gates

Payment provider E2E: **BLOCKED** without credentials. Domain ledger tests still run locally.
