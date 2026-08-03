# Verification / Business / Advertising / Monetization — Preflight

**Date:** 2026-08-03  
**Branch:** `feat/community-rebuild`  
**HEAD before work:** `23af140f91cbea8cafe0c4299a35cd33b4975d70`  
**Workspace:** `C:/Users/ACER/Desktop/picom`

## Repo state

| Item | Finding |
|---|---|
| Active branch | `feat/community-rebuild` |
| Dirty worktree | Yes — many unrelated tmp/audit/realtime files plus prior Codex foundation drafts |
| Worktrees | Multiple historical worktrees present; do not modify them |
| Canonical DB | Supabase only (not Neon) |
| Local Supabase | Running (`DB_URL` `127.0.0.1:55422`) |
| `.env.production` / `.env.local` Supabase ref | `ufmtvqtsklqsmqxefbbs` (**picom-staging**) |
| Separate production project | **Not proven** — do not apply this foundation to hosted staging as production |

## Existing systems that must be preserved

| System | Canonical location | Notes |
|---|---|---|
| Creator / Publisher program | `20260803140000_publisher_creator_program_core.sql` + follow-ons | Keep as-is. Eligibility rule `v1-5k-followers-or-3k-founder`. Member count via `COUNT(DISTINCT membership.user_id)` in `20260803160000_publisher_eligibility_member_count_canonical.sql`. Ownership from canonical owner field, not `role_id`. |
| Publisher badges | `publisher_badges` | Separate from PICOM Verified / Business badges. Monetization must not be conflated with badge status. |
| Legacy review badges | `verification_badges` (`20260710195000_profile_verification_badges.sql`) | Extend; do not replace. Existing kinds: `profile_reviewed`, `community_official`, `role_managed`. |
| Subscription billing records | `subscription_records` (`20260715140100_root_dashboard_operations_core.sql`) | Keep as payment/lifecycle store; not a badge source. |
| Audit | `audit_log`, `verification_audit_logs` | Reuse; add provider webhook + idempotency foundations only if missing. |
| Admin helpers | `is_app_admin()`, `is_root_owner()`, `app_admins` | Available for platform-admin RLS. |
| Organizations | None before this foundation | New canonical org model required. |
| Advertising / sponsored delivery | No production campaign engine found | Advertiser account foundation only. |

## Prior partial work (Codex draft)

Present in dirty tree (must be audited, completed, and hardened — not discarded blindly):

- `supabase/migrations/20260803173000_verification_business_platform_foundation.sql`
- `supabase/tests/rls/verification_business_platform.sql`
- `src/types/verificationBusiness/*`
- `src/services/verificationBusiness/platformServices.ts`
- `src/domain/publicBadgeResolver.ts`
- `scripts/verification-business-domain-contract-test.mjs`
- `package.json` scripts `verification-business:domain:test`, `verification-business:rls:test`

## Gaps identified in draft

1. Missing table `GRANT`s for authenticated role — RLS policies alone are insufficient.
2. `business_applications` readable only by admin; applicants/org owners need a non-internal view/policy.
3. Overlapping unique indexes on `verification_badges` (legacy `revoked_at is null` vs new `status = 'active'`).
4. RLS matrix incomplete vs required negative/positive cases.
5. Domain contract tests too thin (resolver only).
6. Documentation missing (`ARCHITECTURE`, `DATA_MODEL`, readiness, this preflight).
7. No production apply (correct — must remain blocked without separate production project).

## Decision

Proceed with additive foundation on branch, validate on **local** Supabase only, preserve Creator/Publisher migrations untouched, and mark hosted production apply as **BLOCKED**.
