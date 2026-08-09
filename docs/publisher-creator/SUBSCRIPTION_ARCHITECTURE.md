# Subscription Architecture

## Flow

1. Client selects `product_id` only
2. Server loads authoritative `publisher_subscription_products` (amount/currency/interval)
3. Checkout session created by server/provider adapter
4. Provider webhook finalizes status — **not** client redirect

## States

`INCOMPLETE | TRIALING | ACTIVE | PAST_DUE | CANCEL_AT_PERIOD_END | CANCELLED | UNPAID | EXPIRED`

## Entitlements

Table `publisher_subscription_entitlements` is separate from payment UI.

- Cancel at period end: entitlement remains until `expires_at`
- Immediate cancel: unsupported until provider policy exists
- Subscriber-only chat remains **OFF** until entitlement + chat runtimes are certified

## Checkout gate

`create_publisher_checkout_session` returns `PAYMENT_PROVIDER_NOT_CONFIGURED` while provider runtime is blocked.

## Product UI

Create Tier remains disabled while provider/flags are OFF. Products default `active=false`.
