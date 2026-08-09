# Finance Operations Runbook

## Production target

Supabase `picom-production` / `cqnsetsmcduraryemhbi`

## Flags

All monetization flags remain OFF until provider + legal + KYC/payout gates clear.

## Incident: webhook storm

1. Confirm signature failures in logs (no secret values)
2. Check `provider_webhook_events` duplicates (idempotent)
3. Quarantine unresolved in `publisher_finance_event_failures`
4. Do **not** manually INSERT paid ledger rows as production proof

## Manual adjustment

Only `root_create_publisher_finance_adjustment` with `finance.write`:

- amount_minor, currency, direction, reason (≥8), ticket, idempotency key
- Creates ADJUSTMENT ledger row + audit

Never UPDATE/DELETE ledger history.

## Reconciliation

Use internal fixtures with `internal_test=true` only.  
Script: `node scripts/publisher-monetization-smoke.mjs`

## Payouts / KYC / tax

Not implemented in TASK31. UI must show payouts unavailable. Do not fake KYC verified.
