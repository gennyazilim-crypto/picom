# PICOM Verified Subscription — Preflight

**Date:** 2026-08-03
**Branch:** `feat/community-rebuild`
**HEAD:** `4533587d207e79c0486783ad0eb5f4f48a0e67ca`
**Foundation commit (mixed, do not amend):** `4533587d`
**Foundation migration LF SHA-256:** `6fc0010d9a82e4b7fe0b0fdec95f686bedd6355b0456574de32cb04474dfd64c`

## Dirty tree policy

Unrelated dirty files present (brand/installer/tmp). This task must not stage them.

## Existing systems

| Area | Finding | Action |
|---|---|---|
| Foundation tables | `account_entitlements`, `verification_cases`, `verification_badges`, `provider_webhook_events`, `platform_idempotency_keys` | Reuse / extend |
| Root `subscription_records` | Admin ops aggregate (`mrr_cents`), not user-owned PICOM Verified | Do **not** reuse for user billing |
| Billing provider runtime | No Stripe/Paddle/Lemon SDK in app runtime | Create Stripe adapter + fail-closed when secrets missing |
| Historical billing MVP doc | `docs/billing-mvp-optional-decision.md` No-Go for generic commercial MVP | Explicit product override: PICOM Verified Task 02 |
| Account Center | `src/account/*` on `account.picom.gg` | Add `/verified`, `/account/billing`, verification/status routes |
| Edge Functions | Shared auth/http/cors patterns | Add billing + verification + webhook functions |
| Email worker | `subscription_confirmation`, `payment_failure`, `refund_status` templates exist (`billing` category) | Enqueue via outbox; never SMTP in webhook |
| External links | `externalLinkService` HTTPS allowlist | Checkout/portal via allowlisted HTTPS only |
| Ads delivery | Root `ad_campaigns` admin inventory; no end-user placement engine | Add canonical `resolveAdEligibility` decision service |
| Badge resolver | `src/domain/publicBadgeResolver.ts` | Keep; reconcile `verified` badge server-side |
| Env Supabase ref | Staging `ufmtvqtsklqsmqxefbbs` | Hosted production apply **BLOCKED** |
| Stripe credentials | Not present in `.env.example` / local | Provider E2E **BLOCKED** until test-mode secrets configured |

## Provider decision

- No existing runtime billing provider → implement **Stripe** adapter as first provider.
- No second parallel provider.
- Missing secrets → typed `NOT_CONFIGURED` / fail-closed; no fake checkout URLs.

## Next migration timestamp

`20260803210000_picom_verified_subscription_and_entitlements.sql` (after foundation `20260803173000`).
