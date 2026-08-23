# Payout ledger and batches

## Earnings lifecycle

`pending` → `held` → `available` → `reserved_for_payout` → `processing` → `paid`
Also: `reversed`, `disputed`, `expired`.

Invalid / under-review traffic cannot become `available` for payout.

## Holds vs reserves

- **Hold** blocks payout eligibility / scheduling.
- **Reserve** reduces available balance by amount without deleting accruals.

## Available balance

Computed server-side by `compute_partner_balance` from accruals minus active reserves. Clients cannot write balance snapshots.

## Batches

1. `preview_payout_batch` — no state change
2. `create_payout_batch` — locks accruals (`FOR UPDATE SKIP LOCKED`), creates items + mappings, sets `reserved_for_payout`
3. Dual approval via `approve_payout_batch` when enabled
4. `claim_payout_batch_for_processing` — kill-switch gated; provider send is Edge/worker only

## Invariants

- platform bps + partner bps = 10000
- gross − reserve − withholding − fees = net
- batch totals = sum(items)
- paid accrual cannot remount to another item
