# Advertiser accounts

## Classes

- **Standard advertiser:** individual, sole trader, company, agency, or brand without a Business badge. Campaign-based advertising.
- **Verified Business advertiser:** approved Business organization with profile/badge, team, and promotion bridge. Still requires creative/campaign policy review.

Advertiser status is **not** a public trust badge. Verified Business does **not** auto-approve creatives.

## Ownership

- `owner_type`: `user` | `organization`
- Duplicate active accounts per owner are blocked by unique `(owner_type, owner_id)`.
- Client cannot set `advertising_status=active`, spend limits, or risk status.

## Team roles

`advertiser_owner` / `owner`, `advertiser_admin`, `billing_manager`, `campaign_manager`, `creative_manager`, `analyst`, `compliance_contact`.

Last owner cannot be removed. Business org membership does not grant unlimited advertiser powers.

## Lifecycle

`draft` → `pending_verification` → Root `active` / `limited` / `suspended` / `revoked`.

Billing: `not_configured` | `pending` | `funded` | `payment_required` | `past_due` | `blocked` (plus legacy values).

## Onboarding routes

`/advertise`, `/advertise/create-account`, `/advertiser/dashboard/*`.

## RLS

Members read own accounts; financial writes are RPC/service only. See migration `20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql`.
