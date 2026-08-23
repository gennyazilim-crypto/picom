# Financial reconciliation

## Layers

1. **Revenue** — spend ledger → attribution → accrual → contract share
2. **Payout** — batches/items ↔ provider transfer/payout state
3. **Balance** — available / reserved / processing / paid / returned

Tables: `financial_reconciliation_runs`, `financial_reconciliation_findings`, `provider_balance_snapshots`.

## Rules

- Findings never silently mutate the append-only ledger
- Corrections use `financial_adjustments`
- Variance ≠ matched
- Without provider credentials, provider reconciliation stays **BLOCKED** (not PASS)

## Dual approval

Batch create vs approve separation when `payout_dual_approval_required` is true.
