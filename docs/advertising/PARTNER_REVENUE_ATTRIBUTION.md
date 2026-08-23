# Partner revenue attribution

## Eligibility

Creator/Publisher badges alone are insufficient. Required:

- `monetization_accounts.monetization_status = active`
- compliance clear
- active `revenue_share_contracts`
- valid (non-invalid) traffic
- no self-traffic (partner cannot be advertiser member)

## Accrual

`ad_partner_attributions` + `partner_revenue_accruals` with hold period from contract. Shares from contract percentages (not hard-coded). Invariant: platform + partner = eligible.

## Reconciliation

`reconcile_ad_revenue_period` is idempotent and disabled unless `ad_reconciliation_enabled` setting is true. Posts into existing `revenue_ledger` without mutating prior rows.

## Payout boundary

This task does **not** send real payouts. Accrual `paid` is reserved for a future payout provider E2E.
