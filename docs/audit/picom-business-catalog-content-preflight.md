# PICOM Business Catalog & Brand Content — Preflight

**Date:** 2026-08-03  
**Branch:** `feat/community-rebuild`  
**HEAD:** `7187651038769936703a9a340399d2816ea60592`

## Dirty tree policy

Unrelated brand/installer/tmp/`vite.config.web.ts` dirt present. Do not stage.

## Mapping

| Required concept | Existing canonical | Missing | Additive change | Migration | UI | External blocker |
|---|---|---|---|---|---|---|
| Business products | `business_products`, `create_business_product`, `public_business_products` | price_display_mode, brand fields, expanded availability/types, moderation reason, publish RPCs | ALTER + RPCs | Y | Dashboard + public detail | Hosted apply |
| Product media | `business_product_media` (asset/external) | storage_path, scan, processing, sha256, primary | ALTER/extend + upload Edge | Y | Media editor | Malware/transcoder |
| Variants | none | options/values/variants | New tables + RPCs | Y | Variant editor | — |
| Localization | `SUPPORTED_UI_LANGUAGES` | product/collection localizations | New tables | Y | Locale editor | — |
| Country availability | none | `business_product_countries` | New table | Y | Country editor | — |
| Collections | `business_product_collections` + items | visibility, cover, localization, publish RPC | ALTER + RPCs | Y | Collections UI | — |
| Business posts | `business_posts` (org-authored, organic default) | disclosure state, moderation, schedule, company_news | ALTER + publish/promote RPCs | Y | Composer | Scheduler worker |
| Product tagging | `business_post_products` + `tag_business_post_product` | max tags, published-only, variant display | Strengthen RPC + checks | Y | Tag picker | — |
| Feed integration | Separate `business_posts` (not user feed posts) | Bridge/read APIs; avoid parallel user feed rewrite | Keep org posts + public views | Partial | Profile tabs | Full feed merge later |
| Advertiser | `advertiser_accounts` | Link from promotion | Reuse | N | Promote flow | — |
| Ad campaigns | `ad_campaigns` (Root ops) | org/advertiser/snapshot FKs for drafts | ALTER additive columns + draft-only create RPC | Y | Campaign draft link | Delivery engine |
| Creative snapshot | none | immutable snapshot | New append-only table | Y | Promote | — |
| Promotion request | none | request lifecycle | New table + RPCs | Y | Promote UI | Legal copy active |
| ad_free | `resolve_ad_eligibility` | sponsored placement regression | Contract tests | N | — | — |
| Analytics | none business-specific | events + daily aggregates | New tables + ingest RPC | Y | Dashboard analytics | — |
| Reports | foundation verification cases | product/post report types | Tables or case types | Y | Report UI | — |
| Root review | Business applications module | Products/posts/promotion modules | Root pages + RPCs | N/Y | Root | — |
| Legal gates | `business_legal_document_versions` pending_legal | Product/listing/sponsored policies active | Seed pending_legal keys | Y | Blocking UI | LEGAL COPY REQUIRED |
| Storage | business-profile-assets, business-verification-documents | product media bucket | New private bucket | Y | Upload session | Hosted bucket |
| Docker/pgTAP | harness exists | engine | — | — | — | BLOCKED |

## Preserved blockers

Do not fake-resolve: production project, hosted apply, malware scanner, domain E2E, legal copy, Docker pgTAP, Stripe/billing seed.
