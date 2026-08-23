# Payout operations runbook

## Daily

1. Kill-switch status
2. Stale `processing` items
3. Reconciliation findings
4. Returned payouts / holds
5. Tax form expiry queue

## Batch flow

Preview → create → four-eyes approve → claim/process (only if provider secrets + switches enabled).

## Incidents

- Provider outage: leave items retryable; do not blind resend after timeout — retrieve first
- Kill switch: stops new provider sends; does not rewrite paid history
- Escalation: Root finance + `info@picom.gg` for commercial; `verify@picom.gg` for identity

## Evidence

Export reconciliation runs as immutable evidence; retain per policy. Hosted production apply remains **NOT DONE** without dedicated production Supabase.
