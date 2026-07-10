# Organization billing plan

## Status

**Commercial planning only.** Picom has no payment provider, checkout, subscription, invoice, pricing, entitlement runtime, webhook, billing secret, or payment UI. Commercial launch, pricing, legal terms, tax treatment, and organization tenancy are not approved.

Sensitive payment collection must remain provider-hosted. Picom must never store card number, CVV, bank credentials, raw payment tokens, provider secret keys, webhook signing secrets, or unreviewed tax documents.

## Billing customer and ownership

The billable customer is a future enterprise organization, not an individual community. A billing account has an authorized billing contact/role separate from OrganizationOwner, SecurityAdmin, community Owner/Admin, and content permissions.

- BillingAdmin can view plan/invoice metadata and open the hosted billing portal.
- Paid/overdue status never grants or expands community/private-content access.
- Organization suspension or downgrade never deletes data automatically.
- Consumer communities remain unaffected unless explicitly adopted into an entitled organization.

## Plan model placeholder

Do not set prices until market, cost, tax, and contract review. Candidate commercial dimensions:

- organization base entitlement;
- included active seats;
- additional active-seat bands;
- approved storage/retention/voice usage limits;
- enterprise options such as SSO/SCIM/audit export/residency only after each is production-ready;
- support/SLA tier.

Avoid feature pricing that weakens security or privacy. RLS, encryption, account safety, basic moderation, and data rights are not optional paid security controls.

## Seat definition

Preferred first model: monthly active entitled organization members, measured server-side from active organization membership, not community message surveillance.

Define before launch:

- invited/pending/suspended/deprovisioned/service/bot/guest seat treatment;
- duplicate users across workspaces/communities count once per organization;
- mid-cycle additions/removals and proration;
- grace/overage policy and dispute corrections;
- snapshot timestamp/timezone and auditable calculation version.

Seat usage returns aggregate counts to billing. Do not send message content, channel activity, presence history, or private profile data to the provider.

## Subscription and entitlement lifecycle

Suggested states: `trialing`, `active`, `past_due`, `grace`, `suspended_billing`, `cancel_scheduled`, `cancelled`. Provider state is normalized server-side into versioned Picom entitlement state.

- Webhook processing is signature-verified, idempotent, ordered, replay-resistant, audited, and retried.
- Entitlement changes happen only after durable event processing.
- Renderer feature flags improve UX but cannot grant purchased/server permissions.
- Temporary provider outage uses last verified entitlement plus bounded grace; it does not fail open indefinitely or destroy access/data.
- Downgrade blocks new premium actions first and provides remediation/export; it does not expose or purge content.

## Invoice model

The payment provider is the financial system of record. Picom may store minimal invoice metadata:

- opaque provider invoice/customer/subscription IDs;
- organization ID;
- invoice status, currency, total amount in minor units;
- service period, issued/due/paid timestamps;
- provider-hosted invoice URL reference obtained through trusted backend at request time;
- sync version/timestamps.

Do not store full payment methods, raw provider payloads, card/bank details, tax documents, or public invoice URLs. Invoice access requires BillingAdmin and step-up authentication where appropriate.

## Payment provider decision

No provider is selected. Run a documented evaluation for:

- supported countries/currencies/payment methods;
- merchant-of-record versus payment-processor responsibilities;
- VAT/GST/sales-tax calculation, registration, invoicing, refunds, credit notes;
- B2B quotes/contracts/POs/net terms and seat metering;
- hosted checkout/customer portal and PCI scope;
- webhook signing/idempotency/event replay and sandbox quality;
- subscription/usage/proration/dunning capabilities;
- data region, privacy/DPA/subprocessors, export/deletion;
- SDK/API stability, observability, support, fees, lock-in, migration/exit.

Candidates may include a merchant-of-record service or a payment processor plus tax service. Product, finance, legal, security, privacy, and operations must approve the decision; do not choose solely by SDK convenience.

## Proposed schema impact

- `organization_billing_accounts`: organization, provider, opaque customer ID, status, billing-contact reference.
- `organization_subscriptions`: plan/version, normalized state, periods, cancellation/grace timestamps, provider reference.
- `organization_entitlements`: stable feature/limit keys, source subscription, effective/version timestamps.
- `organization_seat_snapshots`: aggregate count, period, calculation version, checksum.
- `organization_invoice_metadata`: minimal provider invoice metadata.
- `billing_webhook_events`: provider event ID/hash, type, status/attempts, timestamps; encrypted/redacted payload storage only if separately approved.
- append-only billing/entitlement admin audit events.

Tables require organization scope, RLS/trusted RPCs, unique provider IDs, no cross-tenant references, and intentional retention/deletion. Provider secrets stay in a secret manager, not database rows exposed to Supabase clients.

## Desktop boundary

- Authorized admins see read-only normalized plan, seat count, entitlement, invoice status, and safe errors.
- Payment/portal actions open an allowlisted provider-hosted HTTPS URL through `externalLinkService` after backend authorization.
- React components never collect card/bank/tax credentials or call provider APIs directly.
- Billing remains outside ServerRail/community permissions and adds no mobile UI.

## Legal, tax, and compliance gates

- entity/merchant model and customer contract;
- VAT/GST/sales-tax nexus, invoices, refunds, credits, revenue recognition;
- PCI scope and provider responsibility;
- privacy/DPA/subprocessor/retention/data-rights handling for billing contacts;
- consumer-versus-B2B terms, trial/renewal/cancellation/dunning notices;
- accessibility, localization, supported currencies and price-display rules;
- sanctions/fraud/chargeback handling and support escalation.

Legal/tax advice and provider agreements must be finalized before any real charge.

## Security and reliability gates

- secret manager and rotation runbook;
- provider-hosted checkout/portal allowlist;
- webhook signature/replay/idempotency/order tests;
- cross-tenant billing metadata/RLS tests;
- entitlement outage/grace/downgrade/rollback tests;
- invoice access and redaction tests;
- audit, monitoring, incident and reconciliation runbooks;
- sandbox end-to-end plus finance reconciliation before production.

## Rollout

1. Approve organization tenant and entitlement semantics.
2. Select provider through legal/tax/security/finance review.
3. Build backend-only sandbox event ingestion and reconciliation.
4. Add read-only internal billing status.
5. Pilot provider-hosted checkout/portal with internal organization.
6. Test failures, duplicates, refunds, tax, dunning, downgrade and rollback.
7. Limited commercial pilot, then staged launch.

Until approval, Picom must not advertise pricing, paid enterprise features, invoices, or payment capability.
