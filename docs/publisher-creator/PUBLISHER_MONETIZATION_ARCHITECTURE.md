# Publisher Monetization Architecture

Updated: 20260809T161807Z  
Branch: release/picom-canonical-production  
Base: 850c10e7

## Scope

Production-grade **foundation** for Publisher subscriptions, donations, ad revenue attribution, and an immutable revenue ledger. This is **not** live commercial activation.

## Reused foundations

From `20260803173000_verification_business_platform_foundation.sql`:

- `monetization_accounts` (extended with eligibility/provider/KYC/tax hooks)
- `revenue_share_contracts`
- `revenue_ledger` (period settlement; remains append-only)
- `provider_webhook_events`
- `platform_idempotency_keys`
- Root RBAC: `finance.read` / `finance.write` / `finance.approve` (not `dashboard.read`)

## New domains (TASK31)

| Domain | Tables |
|--------|--------|
| Fee policy versions | `publisher_monetization_fee_policies` (draft until business-approved) |
| Subscription products | `publisher_subscription_products` |
| Subscriptions | `publisher_subscriptions` |
| Payments | `publisher_payment_transactions` |
| Donations | `publisher_donations` |
| Ad attribution | `publisher_ad_revenue_attributions` |
| Event ledger | `publisher_finance_ledger_entries` |
| Finance audit | `publisher_finance_audit_events` |
| Event failures | `publisher_finance_event_failures` |
| Entitlements | `publisher_subscription_entitlements` |

## Eligibility

Server function `compute_publisher_monetization_eligibility` — states:

`NOT_ELIGIBLE | ELIGIBLE | ONBOARDING | PAYMENTS_ENABLED | PAYMENTS_RESTRICTED | KYC_REQUIRED | PAYOUTS_DISABLED | SUSPENDED`

Distinct from Publisher badge, general Verified, KYC, and payout readiness.

## Provider

Provider-neutral Edge Function `publisher-payments`:

- Checkout + webhook fail-closed without `PAYMENT_PROVIDER*` secrets
- Signature verification stub (HMAC) ready for provider adapters
- No economic mutation until provider adapter certified

**Runtime:** `BLOCKED_PROVIDER_CONFIGURATION`

## Feature flags (production OFF)

- `enablePublisherMonetization`
- `enablePublisherSubscriptions`
- `enablePublisherDonations`
- `enablePublisherAdRevenue`
- `enablePublisherEarningsDashboard`

## Readiness matrix

| Gate | Status |
|------|--------|
| Code / schema / RLS | GO |
| Money model (integer minor) | GO |
| Revenue ledger | GO |
| Provider sandbox | NOT_CONFIGURED |
| Live payment acceptance | OFF |
| KYC | NOT_CERTIFIED |
| Payouts | NOT_IMPLEMENTED |
| Legal monetization terms | BLOCKED_CONTENT_APPROVAL |
| Tax compliance | BLOCKED_LEGAL_PROVIDER_CONFIGURATION |
| Public monetization | OFF |

See also: [REVENUE_LEDGER.md](./REVENUE_LEDGER.md), [MONETIZATION_SECURITY.md](./MONETIZATION_SECURITY.md).
