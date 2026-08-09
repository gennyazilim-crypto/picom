# Publisher KYC Architecture

Updated: 20260809T170836Z  
Base: 6ce67971

## Separation

KYC is **not** PICOM Verified badge, Publisher approval, or Business verification.

Canonical statuses: `NOT_STARTED | REQUIRED | ONBOARDING | PENDING | MORE_INFORMATION_REQUIRED | VERIFIED | REJECTED | RESTRICTED | EXPIRED`

## Provider

Prefer provider-hosted onboarding. PICOM stores refs + status only — no passport/selfie storage.

Without credentials: `BLOCKED_PROVIDER_CONFIGURATION`

Edge: `publisher-payouts` `/kyc/session` + `/webhook/kyc` fail-closed.

Client cannot set `VERIFIED`. Trusted path: `service_sync_publisher_kyc_status` (service_role).
