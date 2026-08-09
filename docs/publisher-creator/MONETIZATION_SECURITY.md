# Monetization Security

## Secrets

Never in client/renderer:

- `PAYMENT_PROVIDER_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- service-role keys
- card/bank credentials

## Webhook

- Raw body signature verification
- Bounded payload
- Event allowlist
- Environment separation TEST vs LIVE
- Idempotent `provider_webhook_events`
- Unknown events ack without economic mutation
- Failures → `publisher_finance_event_failures` (no raw sensitive payloads)

## RLS

| Role | Access |
|------|--------|
| Normal user | No Publisher earnings; no ledger mutation |
| Subscriber | Own entitlement via safe RPC |
| Publisher | Own aggregates/transactions via RPC; no ledger mutation; no foreign finance |
| Stream moderator | No finance |
| dashboard.read | **No** finance |
| finance.read / root | Explicit cross-Publisher read; audited |
| service_role | Trusted ledger writers |

## Privacy

Publisher transaction views omit buyer email, billing address, card data, IP, fraud metadata, webhook bodies.
