# PICOM Advertising Platform Readiness

**Date:** 2026-08-03
**Branch:** `feat/community-rebuild`
**HEAD before:** `2b77f7256021f20fdd317d96b2cf7cb9aaf4225d`
**Implementation commit:** `39810fb8`
**HEAD after:** `8f5a7b91d235d52d2c907aee8a6f46064a925690`

## 1. Executive verdic

**PRODUCTION CODE READY — HOSTED/EXTERNAL GATES BLOCKED**

## 2–4. Preflight / mapping

See `docs/audit/picom-advertising-platform-preflight.md`. Extends foundation advertiser accounts, Root `ad_campaigns`, catalog `ad_creative_snapshots`, `resolve_ad_eligibility`, monetization contracts/ledger. No parallel campaign/ledger system.

## 5. Migration

`supabase/migrations/20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql`
LF-normalized SHA-256: `91b3d1990d6b3d1d46f2a89e3bf5a94da8e67b316419baa40bf17c86bfd846c9`

## 6–29. Implementation summary

| Area | Result |
|---|---|
| Advertiser onboarding | `create_advertiser_account_v2` + Account routes `/advertise*` |
| Team | Expanded roles + last-owner guard |
| Campaign/ad set/creative | Server RPCs; client cannot activate/approve |
| Snapshots | Immutable; append-only trigger retained |
| Targeting | Allowlist + sensitive rejection; political closed |
| Placements | Registry seeded disabled + kill switches |
| Review | Append-only `ad_review_decisions` |
| Funding/reservation/spend | Provider-neutral; append-only ledger |
| Delivery | `resolve_ad_delivery` + Edge `ads-delivery` tokens |
| Frequency | `ad_frequency_counters` |
| Impression | `v1_50pct_1s` visibility gate |
| Click | Snapshot destination only |
| Conversion | Tables + unverified default; provider E2E BLOCKED |
| Invalid traffic | Local rules + reversal RPC; fraud provider BLOCKED |
| ad_free | Uses `resolve_ad_eligibility` |
| Transparency / hide / report | RPCs + public-safe explanation |
| Partner attribution | Contract-driven shares; no payout send |
| Reconciliation | Idempotent RPC; setting-gated |
| Root ops | AdvertisingPage Root actions |
| Workers | `ad_worker_jobs` schema; scheduler setting default false |

## 30–33. Tests / builds

- advertising campaign/delivery/ledger/transparency/partner regressions: **PASS**
- Creator/Publisher + Verified ad-free + Business catalog/organic regressions: **PASS**
- typecheck / account / web / desktop builds: **PASS**
- RLS pgTAP: **BLOCKED** (Docker unavailable); contract file presen

## 34–38. External gates (BLOCKED)

1. Dedicated production Supabase — not presen
2. Hosted migration/RLS apply — **NOT DONE**
3. Payment / funding provider E2E — **BLOCKED**
4. Fraud provider E2E — **BLOCKED**
5. Conversion provider E2E — **BLOCKED**
6. Worker/scheduler hosted E2E — **BLOCKED** (`ad_scheduler_enabled` false)
7. URL reputation / malware scanner — **BLOCKED**
8. Legal copy — seeded `pending_legal` → **LEGAL COPY REQUIRED**
9. Production placement enablement — placements seeded **disabled**
10. Payout provider E2E — out of scope / **BLOCKED**

Staging ref `ufmtvqtsklqsmqxefbbs` is **not** production.

## 39. Final verdic

**PRODUCTION CODE READY — HOSTED/EXTERNAL GATES BLOCKED**
