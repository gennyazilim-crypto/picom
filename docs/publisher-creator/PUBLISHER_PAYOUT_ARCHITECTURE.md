# Publisher Payout Architecture

## Domains

- `publisher_payout_accounts` — provider refs + masked destination
- `publisher_payout_holds` — KYC/COMPLIANCE/MANUAL_REVIEW/...
- `publisher_payout_requests` — REQUESTED→…→PAID/FAILED/REVERSED
- `publisher_payout_batches` — single-currency batches
- `publisher_payout_policies` — draft until business-approved

## Eligibility

`evaluate_publisher_payout_eligibility` checks monetization, KYC VERIFIED, tax profile, verified payout account, holds, available balance, policy minimum, **and** provider capability.

Without provider: always returns provider blocked reason.

## Ledger

1. Reserve: `PAYOUT_RESERVED` debit available  
2. Paid: `PAYOUT` debit paid (reserve remains; available already reduced)  
3. Fail: `PAYOUT_RELEASED` credit available  
4. Reverse paid: `PAYOUT_REVERSAL` credit available  

## Live payouts

`OFF` / `OFF_PENDING_BUSINESS_APPROVAL`
