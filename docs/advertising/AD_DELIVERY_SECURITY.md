# Ad delivery security

## Resolve

`resolve_ad_delivery` checks:

1. Global advertising enabled / kill switch
2. Placement enabled
3. `resolve_ad_eligibility` (PICOM Verified **ad_free**)
4. User hide/block preferences
5. Active approved funded candidates
6. Frequency caps
7. Deterministic priority selection
8. Decision audit row + public-safe creative DTO

## Tokens

Edge `ads-delivery` signs short-lived HMAC tokens with `AD_DELIVERY_SIGNING_SECRET`. Missing secret → fail closed. Renderer never receives the secret.

## Impressions

Billable only when visibility policy `v1_50pct_1s` passes (≥50% visible for ≥1000ms). Background/hidden evidence must not bill. Duplicate `client_event_id` is idempotent.

## Clicks

Destination URL comes from snapshot only. Open redirects / javascript/data/file blocked. Client cannot override destination.

## Transparency

`get_ad_decision_explanation` returns sponsored disclosure + broad safe factors. No bids, fraud scores, or internal targeting expressions.

## Invalid traffic

Local rule engine marks duplicates/expiry/mismatch. External fraud provider E2E remains BLOCKED when unset.
