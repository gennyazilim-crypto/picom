# Revenue Ledger

## Accounting model

**Directional single-sided publisher ledger** (not pseudo double-entry).

Authoritative event table: `publisher_finance_ledger_entries`.

Period/contract summaries remain in `revenue_ledger` (verification-business).

### Money

- All amounts: `bigint amount_minor` (integer minor units)
- Currency: ISO 4217 `^[A-Z]{3}$`
- Never float/real/double
- No silent FX

### Direction

- `credit` — increases publisher economic position for the bucket
- `debit` — decreases (fees, refunds, chargebacks, payouts)

`amount_minor` is always **positive**; sign comes from `direction`.

### Balance buckets

| Bucket | Meaning |
|--------|---------|
| `pending` | Economic event exists; not yet available (`available_at` future) |
| `available` | Eligible for future payout |
| `paid` | Payout entry exists |
| `refunded_or_reversed` | Refund/chargeback impact |
| `non_balance` | Informational gross/fee lines (do not double-count with NET) |

### Entry types

Subscription/donation: GROSS + PLATFORM_FEE + PROVIDER_FEE (non_balance) + NET (balance).  
Ads: GROSS + PLATFORM_SHARE (non_balance) + CREATOR_SHARE (balance).  
Corrections: REFUND, CHARGEBACK, CHARGEBACK_REVERSAL, PAYOUT, PAYOUT_REVERSAL, ADJUSTMENT.

### Definitions

- **Gross** — full charged/settled amount before shares
- **Provider fee** — only when provider reports it; never invented
- **Platform fee / share** — from active fee policy or trusted settlement input; no invented public %
- **Publisher net** — balance-affecting credit after fees/shares
- **Pending** — net with future `available_at`
- **Available** — net ready for future payout
- **Refund** — compensating debit of publisher net (provider fee refund not assumed)
- **Chargeback** — compensating debit; balance may go negative (liability retained)
- **Adjustment** — root/`finance.write` only; reason + ticket required
- **Settlement** — trusted ad attribution marked SETTLED and ledgered

### Immutability

Trigger `PUBLISHER_FINANCE_LEDGER_APPEND_ONLY` blocks UPDATE/DELETE.  
Corrections = new compensating rows (`reversal_of_ledger_entry_id`).

### Idempotency

Unique `idempotency_key`; optional unique `provider_event_id`.  
Trusted writers: `service_record_*` (service_role only).

### Balance derivation

RPCs derive balances from ledger. Clients never update balances.  
`internal_test=true` rows excluded from Publisher earnings by default.
