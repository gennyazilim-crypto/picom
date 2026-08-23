# PICOM Verified Subscription — Readiness

**Date:** 2026-08-03
**Branch:** `feat/community-rebuild`
**HEAD before:** `4533587d207e79c0486783ad0eb5f4f48a0e67ca`
**HEAD after / commit:** `042d5f722fff1bba2f610bbf1a05727b145a3162`
**Foundation (do not amend):** `4533587d`
**Migration:** `supabase/migrations/20260803210000_picom_verified_subscription_and_entitlements.sql`
**Migration SHA-256 (LF-normalized):** `a0a4ee0512f9be2fa33a22dd6299b25800f2a42f0cb67e7f5d1899a8a94d921d`

## 1. Executive verdict

**PRODUCTION CODE READY — PROVIDER/HOSTED GATES BLOCKED**

Implementation covers billing schema, entitlement/badge reconciliation, Stripe Edge Functions (fail-closed), Account Center routes, desktop card, ad eligibility, RLS/domain/edge contract tests, and docs. Stripe test-mode E2E and hosted production apply were not executed.

## 2. Branch and HEAD

- Branch: `feat/community-rebuild`
- Pre-task HEAD: `4533587d207e79c0486783ad0eb5f4f48a0e67ca`
- History rewrite / amend of foundation commit: **not performed**

## 3. Preflight

See `docs/audit/picom-verified-subscription-preflight.md`.

## 4. Existing billing/provider findings

- No runtime Stripe/Paddle SDK previously — Stripe adapter added.
- Root `subscription_records` not reused (admin ops aggregate).
- Foundation entitlements / verification / webhook receipt tables reused and extended.

## 5. Migration

Additive migration `20260803210000_picom_verified_subscription_and_entitlements.sql`:

- `billing_customers`, `billing_products`, `billing_catalog_public`, `picom_verified_subscriptions`, append-only history, `billing_invoices`, `account_verification_sessions`, `billing_checkout_sessions`
- `reconcile_picom_verified_entitlements`, `reconcile_verified_account_badge`, `resolve_ad_eligibility`, `get_picom_verified_summary`
- RLS: owner select-only; no authenticated writes; reconcile = service_role

## 6. Changed files (task scope)

Edge: `billing-checkout`, `billing-portal`, `billing-webhook`, `verification-account-session`, shared billing modules, `config.toml`
Domain/UI: Account Center verified/billing pages, desktop Verified card, ad eligibility, services/types
Tests/scripts: domain, edge contract, ad-free leak, RLS SQL
Docs: billing + readiness + preflight
Restore: `vite.config.account.ts`, `index.account.html` (required for Account Center build; were missing from tree)

## 7–10. Lifecycle / entitlement / verification / webhook evidence

- Subscription statuses and history trigger implemented in SQL.
- Entitlements written only via service_role reconcile.
- Badge requires entitlement + verified case + email + not restricted.
- Webhook verifies Stripe signature, dedupes events, uses `provider_state_version`, enqueues email outbox (no SMTP in webhook).

## 11. RLS matrix

Test file: `supabase/tests/rls/picom_verified_subscription.sql`
**Local apply/run:** **BLOCKED** — Docker Desktop engine unavailable (`supabase_db_picom` inspect failed).

## 12. Ad-free leak test

`npm run picom-verified:ad-free:leak` → **PASS**

## 13. Web build

`npm run build:web` → **PASS**
`npm run build:account` → **PASS** (after restoring missing account Vite entry)

## 14. Desktop build

`npm run build:desktop` → **PASS**

## 15. Provider test-mode E2E

**PROVIDER E2E — BLOCKED**
`STRIPE_SECRET_KEY` / webhook secrets / price IDs not configured. No fake checkout URLs. No “Stripe E2E PASS” claimed.

## 16. Hosted apply status

**HOSTED PRODUCTION APPLY: NOT DONE**
Staging ref `ufmtvqtsklqsmqxefbbs` must not be treated as production.

## 17. Blockers

1. Stripe test-mode credentials + Stripe CLI for provider E2E
2. Dedicated production Supabase project for hosted migration/webhook
3. Local Docker Supabase for pgTAP RLS execution
4. Ops seed of `billing_products` with real provider price IDs when secrets exist

## 18. Final verdict

**PRODUCTION CODE READY — PROVIDER/HOSTED GATES BLOCKED**

### Gate summary

| Gate | Result |
|---|---|
| Domain contract | PASS |
| Edge contract | PASS |
| Ad-free leak | PASS |
| Creator/Publisher regression | PASS |
| Typecheck | PASS |
| Web build | PASS |
| Account build | PASS |
| Desktop build | PASS |
| RLS local | BLOCKED (Docker) |
| Provider E2E | BLOCKED (credentials) |
| Hosted production apply | NOT DONE |
