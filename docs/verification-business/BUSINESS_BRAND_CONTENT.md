# PICOM Business Brand Content

## Organization-authored posts

Canonical table: `business_posts`. Posts are authored for an organization with `author_user_id` retained for audit. Default `sponsorship_state` is `organic`.

## Product tagging

`business_post_products` + hardened `tag_business_post_product` (same-org, published/approved only, max 10).

## Organic vs sponsored

Promote flow:

1. `create_business_post_promotion_request`
2. `create_business_promotion_creative_snapshot` (append-only)
3. `create_business_campaign_draft_from_promotion` (campaign **draft** only)

Source post remains organic. Sponsored delivery uses `resolve_sponsored_delivery_eligibility` → `resolve_ad_eligibility` with placement `business_sponsored`.

ad_free users: organic Business content visible; sponsored delivery ineligible.

## Scheduler

`BUSINESS_POST_SCHEDULER_ENABLED` defaults false → schedule publish fail-closed.

## Legal

Sponsored submit requires active sponsored/advertising policies (**LEGAL COPY REQUIRED** while pending_legal).
