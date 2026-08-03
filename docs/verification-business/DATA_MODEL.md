# Verification / Business Platform — Data Model

## Core tables

| Table | Purpose | Append-only? | Sensitivity |
|---|---|---|---|
| `organizations` | Company/brand entity | No | Internal + public display name |
| `organization_members` | Per-user org roles | No | Internal |
| `organization_invitations` | Invite lifecycle | No | Internal email |
| `verification_cases` | Shared verification lifecycle | History append-only | Mixed; internal reason private |
| `verification_case_status_history` | Case status audit | Yes | Internal |
| `verification_badges` | Public badges (extended) | No | Public fields via view; internal reason private |
| `account_entitlements` | Capability grants | No | Private to subject |
| `business_applications` | Web business onboarding | History append-only | Legal/PII; internal notes admin-only |
| `business_application_status_history` | Application audit | Yes | Internal |
| `business_profiles` | Public brand profile | No | Public when published |
| `brand_assets` | Logos/covers metadata | No | Path metadata; storage private until pipeline |
| `business_products` | Catalog | No | Public when published+approved |
| `business_product_media` | Product media ordering | No | Org-scoped |
| `business_product_collections` | Collections | No | Org-scoped |
| `business_product_collection_items` | Collection membership | No | Same-org only |
| `business_posts` | Brand posts (organic vs sponsored) | No | Public when published organic |
| `business_post_products` | Post↔product tags | No | Same-org only |
| `advertiser_accounts` | Ad publishing authority | No | Internal |
| `advertiser_account_members` | Ad account membership | No | Internal |
| `monetization_accounts` | Creator/Publisher revenue state | No | Subject-private |
| `revenue_share_contracts` | Program percentages | No | Admin |
| `revenue_ledger` | Earnings ledger | Yes (trigger enforced) | Subject-readable summary; no client writes |
| `provider_webhook_events` | Provider event dedupe | Soft | Admin; payload hash only |
| `platform_idempotency_keys` | Mutation idempotency | Soft | Actor/admin |

## Important constraints

- One active badge per `(subject_type, subject_id, badge_kind)`
- One primary active personal badge per user
- Business badge requires `subject_type = organization`
- One open verification case / business application per subject/org
- One active entitlement per `(subject, key)` including grace
- One active monetization account per `(subject_id, program_type)`
- Money fields use integer minor units (`*_minor`) or `numeric` percentages for contracts
- Cross-organization product tagging/media/collection links rejected by trigger
- Revenue ledger update/delete raises `REVENUE_LEDGER_APPEND_ONLY`

## Status lifecycles

### Verification case
`draft → pending → requires_input|under_review → verified|rejected|expired|cancelled`

### Badge
`pending → active → suspended|revoked|expired`

### Entitlement
`pending → active → grace_period|suspended|expired|revoked`

### Business application
`draft → submitted → under_review|requires_information|identity_verification_required → approved|rejected|suspended|revoked|expired`

### Business product
`draft → in_review → published|unlisted|out_of_stock|archived|rejected|suspended`

### Monetization
Independent axes: badge / monetization / payout onboarding / compliance

## Sensitive data classification

| Class | Examples | Exposure |
|---|---|---|
| Public | Published profile, published products, active badge kinds | Anon/authenticated public views |
| Subject-private | Entitlements, monetization status, own verification cases | Authenticated subject |
| Legal/PII | Registration/VAT, addresses, application internals | Admin (+ owner view without internal notes) |
| Financial | Contracts, ledger | Admin write; subject read ledger; client cannot mutate |
| Provider | Webhook payload hashes, idempotency hashes | Admin / service role |
