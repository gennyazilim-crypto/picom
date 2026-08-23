# PICOM Verified Billing

## Product model

PICOM Verified separates four concepts:

| Concept | Meaning |
|---|---|
| **Subscription** | Provider-backed monthly/yearly billing lifecycle |
| **Entitlement** | Product rights (`ad_free`, `verified_badge_eligible`, `priority_support`) |
| **Verification** | Account verification case/session lifecycle |
| **Badge** | Public Verified Account badge (requires subscription + verification + compliance) |

Payment alone never activates the public Verified badge.

## Plans

Canonical product key: `picom_verified`

| Plan key | Interval |
|---|---|
| `picom_verified_monthly` | month |
| `picom_verified_yearly` | year |

Prices are stored in `billing_products` / served via `billing_catalog_public`. Clients must not hard-code amounts or accept client-supplied Stripe price IDs.

## Subscription lifecycle

```
checkout created → incomplete/trialing → payment confirmed → active
  → entitlements active
  → if verification complete → badge active
```

Payment issues:

```
active → past_due → grace_period → unpaid/expired
  → entitlements expired/revoked
  → badge suspended/expired
```

Cancel at period end keeps rights until `current_period_end`, then expires.

Refunds/chargebacks are recorded via webhook events; chargeback creates operational review signals and must not be silently ignored.

## Entitlement reconciliation

Server-only: `reconcile_picom_verified_entitlements(user_id, source_event)`

- Reads latest entitling subscription
- Writes `ad_free`, `verified_badge_eligible`, `priority_support`
- Idempotent supersede of prior active/grace rows for source `picom_verified_subscription`
- Invokes badge reconciliation
- Executable by `service_role` only

## Badge eligibility

Server-only: `reconcile_verified_account_badge(user_id, source_event)`

Requires all of:

- `verified_badge_eligible` entitlement active or grace
- verification case `verified` for `picom_verified_account` / `picom_verified`
- email confirmed
- account not banned/suspended/deleted

Creator/Publisher badges are preserved; primary badge selection is not overwritten to Verified by default (`is_primary = false` on auto-grant).

## Verification lifecycle

Edge: `verification-account-session`

- Requires active badge-eligible entitlement
- Prevents duplicate open sessions
- Fail-closed when Stripe Identity credentials are missing (`NOT_CONFIGURED`, case stays `pending`)
- Never fabricates a verified result

## Provider adapter

Canonical provider: **Stripe** (`BILLING_PROVIDER=stripe`).

Shared modules:

- `supabase/functions/_shared/billing-stripe.ts`
- `supabase/functions/_shared/billing-allowlist.ts`

Edge functions:

| Function | Auth | Purpose |
|---|---|---|
| `billing-checkout` | JWT | Create Checkout Session |
| `billing-portal` | JWT | Customer portal |
| `billing-webhook` | Stripe signature (`verify_jwt=false`) | Lifecycle + reconciliation |
| `verification-account-session` | JWT | Identity session |

## Webhook security

- Raw body HMAC signature + timestamp tolerance
- `provider + provider_event_id` unique claim
- Duplicate → safe 2xx no-op
- Out-of-order guarded by `provider_state_version`
- No SMTP inside webhook; emails enqueue to outbox
- Safe logging only (no secrets, cards, raw identity docs, full payloads)

Supported Stripe events include subscription/invoice/refund/dispute and Identity session events listed in Task 02.

## Ad-free behavior

`resolve_ad_eligibility(user_id, placement, context)`:

- `ad_free` → `{ eligible: false, reason: "ad_free_entitlement" }`
- Organic Business / Creator / Publisher / security announcements → `not_paid_placement` (not suppressed as ads; they are simply not paid placements)
- Server decision always wins over client cache
- Desktop offline cache max 15 minutes

## Desktop / web flows

- Account Center: `/verified`, `/verified/checkout`, `/verified/status`, `/account/billing`, `/account/verification`
- Desktop Settings → PICOM Verified card opens allowlisted Account Center / Stripe HTTPS URLs only

## Environment variables

Edge/server only (never `VITE_`):

- `BILLING_PROVIDER`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_IDENTITY_WEBHOOK_SECRET`
- `STRIPE_PICOM_VERIFIED_MONTHLY_PRICE_ID`
- `STRIPE_PICOM_VERIFIED_YEARLY_PRICE_ID`
- `PICOM_ACCOUNT_CENTER_URL`
- `PICOM_CHECKOUT_SUCCESS_URL` / `PICOM_CHECKOUT_CANCEL_URL` (optional; paths still allowlisted)
- `PICOM_APP_URL`

Missing secrets → fail closed (`NOT_CONFIGURED`).

## Operational runbook

1. Configure Stripe test-mode prices and webhook endpoint to `billing-webhook`.
2. Seed `billing_products` rows with provider price IDs (service role / ops).
3. Apply migration on the target Supabase project (staging first; production only on a dedicated production project).
4. Deploy Edge Functions + set secrets.
5. Verify checkout → webhook → entitlement → verification → badge path with a test user.
6. Confirm email-worker drains `subscription_confirmation` / `payment_failure` outbox jobs.
7. Never point staging ref `ufmtvqtsklqsmqxefbbs` as production.
