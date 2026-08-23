# Monetization onboarding

## Badge vs monetization vs payout

- **Badge** is public eligibility status only.
- **Monetization application / account** is the revenue-share program membership.
- **Payout eligibility** additionally requires payout profile completion, provider capabilities, tax suitability, active agreements, holds cleared, and minimum available balance.

An account may be `badge_status=active`, `monetization_status=approved`, and still `payout_onboarding_status=incomplete` — content may accrue under policy, but no payout batch inclusion.

## Programs

Creator and Publisher are separate `monetization_accounts` rows (`program_type`).

## Lifecycle

1. Active badge required to submit application
2. Application: draft → submitted → under_review → approved|rejected|requires_information
3. Contract / legal acceptance (versioned)
4. Payout profile + provider-hosted onboarding
5. Tax profile (private; client cannot set verified)
6. Compliance clear/active
7. Accrual → hold → available → reserved_for_payout → processing → paid

## Gates

- `LEGAL COPY REQUIRED` while monetization legal documents remain `pending_legal`
- Missing payout provider secrets: onboarding link fail-closed
- Missing tax provider: no automatic verified withholding
