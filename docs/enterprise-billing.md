# Enterprise billing placeholder

Picom may support enterprise billing in a future commercial track. This document defines a safe placeholder architecture and intentionally avoids payment processing, invoices, tax handling, or production billing integrations.

## Status

Documentation-only placeholder. No billing runtime, payment provider, pricing UI, checkout, invoice export, or customer billing data storage is added by this task.

## Goals

- Define future enterprise billing boundaries before implementation.
- Keep payment data out of the desktop renderer.
- Avoid storing card data, bank data, or tax identifiers in Picom databases unless a dedicated compliance design exists.
- Separate license entitlement checks from security permissions.
- Document operational and support risks.

## Non-goals

- No billing provider is integrated.
- No checkout or subscription flow is exposed.
- No pricing page is added.
- No invoices or receipts are generated.
- No app feature access depends on billing in this task.
- No secrets, API keys, webhooks, or production credentials are committed.

## Future billing domains

Possible future billing entities:

- organization billing account
- subscription plan placeholder
- seat count placeholder
- invoice metadata placeholder
- payment provider customer reference
- entitlement state
- billing contact reference
- trial status placeholder

Payment-provider identifiers should be treated as sensitive metadata and kept out of client logs/diagnostics.

## Payment data rules

Picom should not store:

- card numbers
- CVV
- bank account numbers
- raw payment provider tokens
- tax documents unless a separate secure system exists
- billing provider secret keys
- webhook signing secrets

A future billing provider should handle sensitive payment collection through provider-hosted flows.

## Entitlements vs permissions

Billing entitlements determine what an organization has purchased. They must not replace security permissions.

Rules:

- Paid status cannot grant community owner/admin privileges.
- Expired billing cannot expose private data.
- Feature limits must fail safely and clearly.
- Backend must enforce entitlement-sensitive limits.
- Desktop UI may hide unavailable paid features but is not the source of truth.

## Future lifecycle events

Potential events:

- billing_account_created
- subscription_started
- subscription_updated
- subscription_cancelled
- payment_failed_placeholder
- invoice_created_placeholder
- entitlement_changed
- billing_webhook_rejected

Audit/log entries must not include card data, provider secrets, webhook signatures, or raw payment payloads.

## Desktop behavior

Future desktop UI should:

- show read-only plan/entitlement status to authorized admins
- open provider-hosted billing portal through safe external link handling
- avoid collecting payment details in React components
- show clear disabled states for unavailable features
- keep normal MVP community chat behavior unaffected

## Security requirements before implementation

- Provider webhook signature validation.
- Secret manager storage for provider keys.
- Redacted logging for webhook payloads.
- Rate limits for billing webhooks.
- Idempotency for webhook event processing.
- Permission checks for billing portal access.
- Privacy/legal review for billing contact data.

## Verification checklist

- Normal users cannot access billing admin views.
- Desktop renderer never receives provider secrets.
- Logs redact payment identifiers and webhook signatures.
- Billing state does not bypass community permissions.
- Failed billing provider calls degrade safely.
- Support diagnostics exclude payment data.

## Risks and TODOs

- Billing failures can incorrectly block customer access if entitlement logic is too aggressive.
- Payment data increases compliance obligations.
- Provider webhook replay and duplicate events require idempotency.
- Billing contact data may have separate retention and deletion rules.
- Pricing, tax, invoicing, and enterprise contracts require product/legal decisions before implementation.
