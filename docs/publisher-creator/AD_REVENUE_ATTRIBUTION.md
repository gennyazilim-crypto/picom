# Ad Revenue Attribution

Does **not** build an ad server. Integrates with trusted campaign/delivery accounting.

## Table

`publisher_ad_revenue_attributions`

- `impressions_valid` / `clicks_valid`
- `traffic_status`: VALID | PENDING_REVIEW | INVALID | WITHHELD
- `gross_revenue_minor`, `creator_share_minor`, `platform_share_minor` (must sum)
- `applied_share_bps` + `fee_policy_id` versioned for audit
- `settlement_status`: PENDING | SETTLED | WITHHELD | VOID

## Rules

- No client-authored revenue
- Invalid/pending traffic → no Publisher settled revenue until VALID
- Historical settled rows never retroactively change when config changes
- Ledger via `service_record_ad_revenue`
