# PICOM Verified Individual — iyzico payment path

This path applies only to `picom_verified_monthly` and `picom_verified_yearly`. It does not cover Business, Creator, Publisher, ads, donations, payouts, a marketplace, stored cards, or recurring charging.

## Trust boundary

1. An authenticated user asks `verified-payment` to create a link for one canonical `billing_products` plan.
2. The Edge Function copies the server-selected amount, currency, interval, and an opaque `conversationId` into `verified_payment_intents` and creates an iyzico Link.
3. The renderer receives only `intentId` and the HTTPS iyzico Link URL; it never receives provider credentials or a payment-success switch.
4. `iyzico-webhook` accepts only an `X-IYZ-SIGNATURE-V3`-validated event. Both it and the user-initiated reconciliation path retrieve the payment from iyzico again.
5. The retrieve response must have a valid iyzico response signature, final `SUCCESS` payment status, approved fraud result, matching conversation ID, amount, currency, and unused provider payment ID.
6. The service-role-only `activate_iyzico_verified_payment` RPC locks the intent and user, creates one canonical `picom_verified_subscriptions` record, and calls `reconcile_picom_verified_entitlements`.

The public Verified badge remains separate: payment activates eligibility and other benefits, while the existing identity/compliance flow controls badge issuance.

## Required production configuration

Set these only as Supabase Edge secrets:

- `IYZICO_API_KEY`
- `IYZICO_SECRET_KEY`
- `IYZICO_API_BASE_URL` (`https://api.iyzipay.com` for production)
- `IYZICO_LINK_PRODUCT_IMAGE_BASE64`
- `IYZICO_VERIFIED_INTENT_TTL_MINUTES` (an approved value from 5 to 1440)
- `IYZICO_WEBHOOK_SIGNATURE_ENABLED=true` after iyzico enables V3 signatures

Merchant Portal must point its HTTPS payment notification URL at the deployed `iyzico-webhook` function. A missing V3 signature is rejected; the code never accepts old signature headers or browser redirect parameters as payment proof.

## Operations

- `expire_iyzico_verified_payment_intents()` runs every five minutes.
- `expire_picom_verified_entitlements()` runs every 15 minutes and reconciles the canonical entitlement set; payment history remains append-only.
- A renewal extends from the active entitlement end. An expired entitlement starts at verified payment time. Calendar months/years use PostgreSQL interval arithmetic, never fixed day counts.

## Current production preflight — 2026-08-09

The production project has no iyzico-named Edge secrets and no billing-related function deployed. Therefore provider verification, webhook signing, live transaction retrieval, and a production canary are blocked until merchant credentials, Link API access, payment-detail retrieval, and V3 webhook signing are enabled and configured.
