# Verification / Business Platform Foundation — Readiness

**Date:** 2026-08-03  
**Branch:** `feat/community-rebuild`  
**HEAD before task:** `23af140f91cbea8cafe0c4299a35cd33b4975d70`  
**HEAD after task (no task commits yet):** `ada43cb5b4440ec1d2e04d98dae5cc377fef0ffb`  
*(Note: `ada43cb5` is an unrelated live-session migration fix that landed on the branch during this work; this task did not create commits.)*

## 1. Executive verdict

**PRODUCTION FOUNDATION READY** for local/schema/domain/service contracts.

Hosted production migration apply was **not** performed and remains **BLOCKED** until a dedicated production Supabase project exists. Current `.env.production` / `.env.local` point at staging ref `ufmtvqtsklqsmqxefbbs`.

## 2. Repo preflight

See `docs/audit/verification-business-platform-preflight.md`.

Key facts:
- Canonical Creator/Publisher program preserved (`20260803140000` + eligibility follow-ons).
- Legacy `verification_badges` extended, not replaced.
- No prior organizations model; foundation adds it.
- Dirty unrelated tmp/realtime files were left untouched.

## 3. Changed files (task-owned)

| Path | Purpose |
|---|---|
| `supabase/migrations/20260803173000_verification_business_platform_foundation.sql` | Additive schema, RLS, RPCs, public/owner views, ledger append-only |
| `supabase/tests/rls/verification_business_platform.sql` | Real JWT-role pgTAP matrix (37 assertions) |
| `src/types/verificationBusiness/*` | Public/admin domain contracts |
| `src/services/verificationBusiness/platformServices.ts` | Typed read/write service layer (no fake success) |
| `src/domain/publicBadgeResolver.ts` | Canonical public badge resolver |
| `src/domain/verificationBusinessLifecycle.ts` | Entitlement/monetization combination helpers |
| `scripts/verification-business-domain-contract-test.mjs` | Domain contract tests |
| `scripts/verification-business-creator-publisher-regression.mjs` | Publisher/creator non-mutation regression |
| `package.json` | Scripts for domain/RLS/regression |
| `docs/audit/verification-business-platform-preflight.md` | Preflight |
| `docs/verification-business/ARCHITECTURE.md` | Architecture |
| `docs/verification-business/DATA_MODEL.md` | Data model |
| `docs/audit/verification-business-platform-foundation-readiness.md` | This report |

## 4. Migration list

| File | SHA-256 |
|---|---|
| `20260803173000_verification_business_platform_foundation.sql` | `6fc0010d9a82e4b7fe0b0fdec95f686bedd6355b0456574de32cb04474dfd64c` |

Local apply method: direct `psql` into `supabase_db_picom` (full `supabase db reset` blocked — see blockers).

## 5. Existing-system compatibility

| System | Result |
|---|---|
| Creator/Publisher tables | Untouched (static regression PASS) |
| Eligibility rule `v1-5k-followers-or-3k-founder` | Intact |
| `COUNT(DISTINCT …)` eligibility migration | Intact |
| Legacy verification badge RPCs/smoke surface | Not rewritten; separate pre-existing DM badge smoke FAIL noted below |
| Feed/post system | Not altered; business posts are a separate org catalog surface by design (existing feed has no org-author contract) |

## 6. RLS matrix

Executed on local Postgres with `authenticated` / `anon` role switching and `request.jwt.claim.sub`.

**Result: 37/37 PASS**

Covered negatives include self-badge activation, entitlement creation, cross-org product tagging, suspended org product create, analyst/content billing reads, ledger client writes, business badge on user subject, unpublished profile anon denial.

Covered positives include owner verification submit, content manager draft product, business admin profile upsert, owner member management, public published profile/product reads, creator monetization read, root application review including internal notes, advertiser create without business badge.

## 7–8. Tests / exact command results

| Command | Result |
|---|---|
| `npm run verification-business:domain:test` | **PASS** |
| `npm run verification-business:creator-publisher:regression` | **PASS** |
| Local pgTAP `verification_business_platform.sql` | **PASS (37/37)** |
| `npm run typecheck` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:desktop` | **PASS** |
| `npm run supabase:migrations:check` | **PASS (248 migrations)** |
| `npm run verification:badges:smoke` | **FAIL (pre-existing)** — expects DM `<VerifiedBadge verification={verification}` markup; unrelated to this foundation and not introduced by these files |
| `npx supabase db reset --yes` | **BLOCKED** — publisher core migration references missing `public.platform_account_restrictions` |
| Hosted production migration apply | **NOT DONE / BLOCKED** — no separate production project; staging ref only |

Aikido SAST on scanned domain/service TS: **0 findings** (Checkov binary missing in environment; Opengrep reported 0 findings).

## 9. Known blockers

1. **Hosted production apply blocked** — `.env.production` uses staging ref `ufmtvqtsklqsmqxefbbs`; no proven dedicated production project.
2. **Full local db reset blocked** — `20260803140000_publisher_creator_program_core.sql` joins `platform_account_restrictions` which is absent from migration history on this branch.
3. **Pre-existing** `verification:badges:smoke` failure on DM VerifiedBadge markup (outside task file set).

## 10. Production deployment prerequisites

1. Dedicated production Supabase project (not staging).
2. Repair/add `platform_account_restrictions` migration ordering so publisher chain applies cleanly.
3. Apply publisher + foundation migrations in order on a non-production dry-run first.
4. Generate/update Supabase types after remote apply (`npm run supabase:types`) against the target project.
5. Do not activate badges, entitlements, payments, or payouts from clients.

## 11. Final verdict

**PRODUCTION FOUNDATION READY**

Meaning: canonical schema, RLS, domain contracts, services, resolver, docs, and local verification for this foundation are in place.  
Not meaning: hosted production deployed, payments live, UI complete, or payouts enabled.
