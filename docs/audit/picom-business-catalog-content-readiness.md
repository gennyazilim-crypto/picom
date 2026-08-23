# PICOM Business Catalog & Brand Content — Readiness

**Date:** 2026-08-03  
**Branch:** `feat/community-rebuild`  
**HEAD before:** `7187651038769936703a9a340399d2816ea60592`  
**HEAD after:** `041787bbafa156ad06be9d3c070b4a6c2bcabced`  
**Commits:** `c6073634` (implementation), `041787bb` (docs)

## 1. Executive verdict

**PRODUCTION CODE READY — HOSTED/EXTERNAL GATES BLOCKED**

## 2. Branch and HEAD

Prior Business application commits preserved. No history rewrite. See git log after landing commits.

## 3. Preflight

`docs/audit/picom-business-catalog-content-preflight.md`

## 4. Existing foundation mapping

Reused `business_products`, media, collections, posts, post_products, advertiser_accounts, `ad_campaigns`, `resolve_ad_eligibility`. No parallel catalog schema.

## 5. Migration

`supabase/migrations/20260803230000_business_catalog_brand_content_and_promotion_bridge.sql`  
LF-normalized SHA-256: `43908b6fca260fdb8fa3748d140873ac2e23661a9b78c813c12d0624ccc7e4d0`

## 6. Changed files

Migration, Edge product-media upload session, catalog services, Business dashboard/product/post UI, Root product/promotion modules, regression scripts, docs. Unrelated brand/tmp dirt left unstaged. Minimal AppIcon/DM typecheck fix included for green typecheck.

## 7–21. Domain outcomes

| Area | Result |
|---|---|
| Product lifecycle | Server submit/publish/unpublish/archive + Root review |
| Variants / localization / countries | Tables + RLS |
| Media | Private bucket; pending malware fail-closed |
| Collections | Extended visibility/cover |
| Business posts | Org-authored organic publish |
| Product tagging | Same-org, max 10, published/approved only |
| Organic/sponsored separation | Promote does not flip source sponsorship_state |
| Promotion / snapshot / campaign draft | Draft-only campaign; append-only snapshot |
| Public product page | `/business/@:slug/products/:productSlug` |
| External URL | HTTPS validator; private/javascript rejected |
| Moderation / reporting | History + report RPC |
| Analytics | Event ingest + cohort-suppressed aggregates; no fake sales |

## 22. RLS

Contract SQL present. **pgTAP execution: BLOCKED** (Docker engine).

## 23–24. Storage / URL E2E

Contract PASS. **MALWARE SCAN E2E: BLOCKED**. **VIDEO TRANSCODE E2E: BLOCKED**. **LIVE URL REPUTATION E2E: BLOCKED**.

## 25–26. Regressions / builds

Catalog / organic-sponsored / product-security / Creator-Publisher / ad-free / Business application domain: PASS  
typecheck / account / web / desktop: PASS (see commit evidence)  
Secret scan on deliverables: PASS

## 27. Legal status

**LEGAL COPY REQUIRED** — catalog/sponsored policy seeds are `pending_legal`.

## 28. Hosted apply

**HOSTED PRODUCTION APPLY: NOT DONE**

## 29. External blockers

Production Supabase, hosted apply/RLS/storage, malware scanner, video transcoder, URL reputation, legal copy active, Docker pgTAP, Stripe/billing (prior), advertising delivery engine (out of scope).

## 30. Final verdict

**PRODUCTION CODE READY — HOSTED/EXTERNAL GATES BLOCKED**
