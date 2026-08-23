# Verification / Business / Advertising / Monetization — Architecture

## Domain boundaries

| Domain | Meaning | Must not be confused with |
|---|---|---|
| Subscription | Paid PICOM Verified package lifecycle (`subscription_records` + future provider events) | Badge issuance |
| Verification | Review case lifecycle for a user or organization (`verification_cases`) | Entitlement or payout rights |
| Badge | Public trust/status marker (`verification_badges` + `publisher_badges`) | Monetization eligibility |
| Entitlement | Product capability such as `ad_free` (`account_entitlements`) | Public badge display |
| Organization | Legal/brand entity and membership (`organizations*`) | Personal `profiles` row |
| Advertiser account | Permission to run ads (`advertiser_accounts`) | Verified Business badge |
| Monetization account | Creator/Publisher revenue-share state (`monetization_accounts`) | Badge alone |

## Mapping from existing tables

| Existing | New / extended | Strategy |
|---|---|---|
| `publisher_profiles`, `publisher_badges`, `publisher_applications` | Unchanged | Preserve eligibility, badges, Live Now gates |
| `verification_badges` | Extended with status/source/primary/metadata + new kinds (`verified`, `creator`, `publisher`, `business`) | Additive extension |
| `subscription_records` | Remains billing lifecycle | Entitlements reference subscription via `source_type`/`source_id` |
| `audit_log` / `verification_audit_logs` | Kept | Added `provider_webhook_events`, `platform_idempotency_keys` |
| None | `organizations`, business profile/product/post, advertiser, monetization, revenue ledger | New foundation |

## Public vs private data

- Public views: `public_profile_badges`, `public_business_profiles`, `public_business_products`, `public_business_posts`, `public_brand_assets`
- Owner application view (no internal notes): `business_application_owner_views`
- Admin-only: raw `business_applications.internal_review_notes`, case history internals, revenue contracts, webhook events
- Client cannot insert/update badges, entitlements, or revenue ledger rows

## RLS model

- Authenticated subject/org-member select policies for owned resources
- Content managers may create draft products/posts; analysts cannot
- Billing/legal application rows are not exposed to analysts/content managers
- Platform admin (`is_app_admin` / `is_root_owner`) for review surfaces
- Append-only trigger on `revenue_ledger` blocks update/delete for all writers

## Creator / Publisher monetization split

`monetization_accounts` stores independent fields:

- `badge_status`
- `monetization_status`
- `payout_onboarding_status`
- `compliance_status`

Example allowed combination: badge active + monetization pending + payout onboarding incomplete → show badge, no payout.

## Future provider integration points

- Subscription webhooks → `provider_webhook_events` + entitlement activation service (not in this task)
- Identity verification providers → `verification_cases.provider*`
- Payout providers → contract/ledger only; no payout senders in this foundation

## Rollback approach

1. Do not apply to hosted production until a dedicated production project exists.
2. Local/staging rollback: reverse migration is additive-only; prefer feature-flagging services and dropping new objects in a dedicated reverse migration if required.
3. Never drop or rewrite publisher/creator tables as part of rollback.
