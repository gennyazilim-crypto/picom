# PICOM Business Application and Verification

## Product model

PICOM Business verifies **organizations**, not personal profiles.

- Applications are created only on the PICOM web / Account Center surfaces.
- A user creates or joins an organization; the personal profile never becomes a Business account.
- Verified Business is long-term verified brand status. Advertising does **not** require a Business badge.
- Creator, Publisher, and PICOM Verified (user subscription) remain independent badge/entitlement systems.

## User vs organization

| Concern | Owner |
|---|---|
| Login identity | User (`auth.users` / `profiles`) |
| Legal applicant | User acting for an organization |
| Business badge subject | `organization` only |
| `business_dashboard` entitlement | Organization subject |
| Public brand profile | `business_profiles` keyed by `organization_id` |

## Business vs advertiser

Advertising foundation remains available without Business verification. Business approval grants badge + dashboard entitlement and unlocks publishable public Business profile policies. It does not auto-create advertiser campaigns.

## Application lifecycle

Canonical statuses: `draft`, `submitted`, `under_review`, `requires_information`, `identity_verification_required`, `approved`, `rejected`, `suspended`, `revoked`, `expired`.

Enforced by `business_application_transition_allowed` and Root-only RPCs:

- Applicants: `upsert_business_application_draft`, `submit_business_application_snapshot`
- Root: `transition_business_application`, `approve_business_application`

Client cannot set arbitrary status. Status history is append-only via foundation trigger.

Submit creates an immutable row in `business_application_submissions` (payload + SHA-256). Submit is blocked with `LEGAL_COPY_REQUIRED` until five **active** legal document versions exist.

## Organization roles

Roles: `organization_owner`, `business_admin`, `billing_admin`, `campaign_manager`, `brand_manager`, `content_manager`, `analyst`, `support_contact`.

Permission intent:

- Owner: settings, team, application, profile publish, ownership transfer initiation
- Business admin: profile + limited team + application completion
- Brand manager: public profile / logo / cover
- Content manager: future products/posts — not legal application fields
- Billing / campaign / analyst / support: least privilege; no legal document visibility by default

## Invitation lifecycle

Statuses: `pending`, `accepted`, `declined`, `expired`, `revoked` (+ legacy `cancelled`).

Raw invitation tokens are never stored. Clients hash with SHA-256 and call `create_organization_invitation` / `accept_organization_invitation`.

Rules: expiry required, one-time accept, email match, no direct `organization_owner` invite (ownership transfer required), suspended orgs cannot invite, rate limited.

## Ownership transfer

Separate RPCs: `start_organization_ownership_transfer`, `accept_organization_ownership_transfer`. Last owner cannot be removed (`remove_organization_member_safe`).

## Document storage

Private bucket: `business-verification-documents`.

Path pattern (server-generated): `business-applications/{organization_id}/{application_id}/{document_id}.{ext}`

MIME allowlist: PDF, JPEG, PNG, WebP. SVG/EXE rejected. Malware scan defaults to `pending`. Approval fails closed while any document is pending/scanning/infected/failed.

Edge Function: `business-document-upload-session` (JWT required).

## Domain verification

Table: `business_domain_verifications`. Consumer mail domains rejected. Edge Function `business-domain-verification-check` is fail-closed: when `BUSINESS_DOMAIN_VERIFICATION_ENABLED!=true` or provider unavailable, status is **not** marked verified.

## Representative verification

Uses verification cases / Root manual decision. Clients cannot write `representative_verified=true`. Missing providers must not invent PASS.

## Approval transaction

`approve_business_application`:

1. Root auth
2. Malware pending gate
3. Transition allowlist
4. Idempotency key
5. Application → approved
6. Organization active
7. Business badge on organization
8. `business_dashboard` entitlement reconcile
9. History via trigger

Suspend/revoke revoke badge visibility, suspend public profile publish state, reconcile entitlements.

## Public Business profile

Route: `/business/@:slug` (Account Center). Readable when:

- organization active
- application approved
- Business badge active
- profile `public_status=published`

DTO allowlists brand fields only (no VAT, registration, address, phones, internal notes, storage paths).

## Root review model

Root Dashboard → Business applications. Decisions require reason codes / internal notes for reject-suspend-revoke. Authorization is DB `is_root_owner()`, not route guards alone.

## RLS matrix

See `supabase/tests/rls/business_application_platform.sql`. Local Docker pgTAP may be BLOCKED without Docker engine.

## Retention

Documents and audit/history use `ON DELETE RESTRICT`. Soft retention / archival preferred over hard delete of compliance rows.

## Operational runbook

See `BUSINESS_REVIEW_RUNBOOK.md`.

## Environment variables

See `supabase/functions/.env.example` (`BUSINESS_*`, `MALWARE_SCANNER_*`). Never expose private keys via `VITE_`.

## Known external gates

- Dedicated production Supabase project
- Hosted migration apply
- Malware scanner provider
- Live DNS/web domain verification provider
- Legal copy approval (seed versions are `pending_legal`)
- Staging ref `ufmtvqtsklqsmqxefbbs` is **not** production
