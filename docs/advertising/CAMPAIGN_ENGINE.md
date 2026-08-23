# Campaign engine

## Model

- **Campaign:** objective, budgets, schedule, pacing, review/delivery status.
- **Ad set:** placements, targeting allowlist, frequency caps, billing event, fixed bid (no fake auction).
- **Creative:** editable draft; delivery uses **immutable** `ad_creative_snapshots`.

## Objectives (v1)

Enabled: awareness, reach, traffic, engagement, video_views, profile_visits, product_views, event_interest, app_install, lead_generation.

Disabled: sales, purchase_optimization, roas_optimization, auction buying.

## Transitions

Server-side matrix; clients cannot mark campaigns `active`/`approved`. Submit requires active advertising legal docs (`LEGAL_COPY_REQUIRED` when pending).

## Targeting

Allowlisted keys only. Sensitive keys rejected (`AD_TARGETING_SENSITIVE_REJECTED`). Political advertising disabled.

## Placements + kill switches

Registry in `ad_placements` (seeded disabled). Root can toggle placements and global advertising kill switch. Fail-closed: disabled placement / global kill → no delivery tokens.
