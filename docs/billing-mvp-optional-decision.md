# Optional billing MVP decision

## Decision: No-Go

Commercial MVP+ is not approved. Picom adds no payment provider, checkout, pricing, subscription, invoice, entitlement schema/runtime, webhook, billing UI, feature flag or credential. Core free beta chat, communities, messages, uploads, safety, privacy and accessibility remain unchanged and cannot be unexpectedly paywalled.

## Approval required before implementation

- dated commercial scope-lock identifying customer (future organization, not accidental community/user), plans/value and displaced work;
- legal entity/merchant-of-record or processor decision; contracts, Terms/Privacy and consumer/B2B cancellation/refund notices;
- tax/VAT/GST/invoice/revenue recognition and supported country/currency approval;
- PCI scope confirmed with provider-hosted checkout/portal; Picom never handles card number, CVV, bank credentials or raw payment token;
- organization tenancy/BillingAdmin/step-up auth, backend entitlement and cross-tenant RLS design;
- secret manager, signed/idempotent/replay-safe webhook, reconciliation, audit, dunning/grace/downgrade/rollback/incident/support;
- sandbox end-to-end and Finance/Legal/Security/Privacy/Product/Operations go/no-go.

## Non-negotiable product boundary

Billing entitlement never grants owner/admin/private-data access and frontend flags never enforce payment/security. RLS, auth, moderation, data rights, blocking/reporting, account safety and basic chat security are not paid controls. Provider outage uses bounded last-known state/grace and does not delete data or fail open indefinitely. Downgrade blocks only approved premium creation/actions with clear recovery/export.

## Future staged path

1. Approve scope/provider/organization model and threat/privacy/data-flow review.
2. Build backend-only sandbox webhook normalization/reconciliation with synthetic data.
3. Add internal read-only entitlement/invoice metadata for BillingAdmin.
4. Open allowlisted provider-hosted checkout/portal through safe external link after backend authorization.
5. Test duplicate/out-of-order events, refund/cancel/dunning, provider outage, tenant isolation and no payment data in logs/diagnostics.
6. Internal commercial pilot, then limited beta only after explicit release decision.

Until approval, no billing entry point is shown and no paid capability is advertised.
