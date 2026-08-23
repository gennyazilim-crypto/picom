# Ad transparency archive

## Public routes

- `/ads/transparency`
- `/ads/transparency/:archiveId`
- `/ads/advertisers/:advertiserId`

## Included

Advertiser display name/type, verified business flag, public creative snapshot, sponsor label, destination domain, delivery window, broad countries/languages/reasons, placements, objective, public policy reason.

## Excluded

Exact bid/pricing, user-level targeting, fraud model, internal notes, spend ledger, bank/billing, private legal data, audience IDs.

## Rules

- Sponsored delivered snapshots only (`materialize_ad_transparency_archive`)
- Organic Business posts excluded
- Preview/test not archived
- Snapshot immutable; retention + legal hold on `ad_transparency_retention`
- Verified Business ≠ PICOM endorsement of ad content
