# Payout provider security

## Adapter

`supabase/functions/_shared/payout-provider.ts` — Stripe Connect style:

- createConnectedAccount / onboarding + update links
- retrieveAccount / normalizeAccountState
- createTransferOrPayout / retrieveTransferOrPayout
- verifyWebhookEvent
- normalizeProviderError (retryable vs terminal)

Missing `PAYOUT_PROVIDER_SECRET_KEY` or `PAYOUT_PROVIDER_WEBHOOK_SECRET` ⇒ fail-closed (`PAYOUT_PROVIDER_NOT_CONFIGURED`).

## Boundaries

- No provider secrets in renderer / `VITE_`
- Bank details stay provider-hosted
- Onboarding return/refresh HTTPS allowlisted
- Callback refreshes state only; completion requires retrieve + webhook
- Duplicate provider event id does not double-pay

## Kill switches

`global_payouts_enabled`, `provider_payouts_enabled`, `creator_payouts_enabled`, `publisher_payouts_enabled`, `batch_processing_enabled` — all default false.
