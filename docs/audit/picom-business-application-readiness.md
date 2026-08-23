# PICOM Business Application — Readiness

**Date:** 2026-08-03  
**Branch:** `feat/community-rebuild`  
**HEAD before:** `575b8af4125771a92b285110a8864ca3d1e073c9`  
**HEAD after:** `e6a6460e3902f03f0777d3a68c8df052922bd4c7`  
**Commits:** `9e909092` (implementation), `e6a6460e` (docs)

## 1. Executive verdict

**PRODUCTION CODE READY — HOSTED/EXTERNAL GATES BLOCKED**

## 2. Branch and HEAD

See git log after commits in this task. Prior chain preserved (`4533587d`, `042d5f72`, `575b8af4`). No history rewrite.

## 3. Preflight

Documented in `docs/audit/picom-business-application-preflight.md`. Foundation tables reused; additive migration only.

## 4. Existing foundation mapping

Organizations, members, invitations, business_applications, profiles, assets, badges, entitlements, review RPC baselines extended — no parallel schema.

## 5. Migration

File: `supabase/migrations/20260803220000_business_application_verification_and_team_management.sql`  
LF-normalized SHA-256: `be37310c444737a78f2bfc8950a6eb3c270b5783ebedde19d2f3357e4611b960`  
No `DROP TABLE`. Legal seed versions status = `pending_legal` (not active).

## 6. Changed files (implementation set)

- Migration + RLS SQL test
- Edge: `business-document-upload-session`, `business-domain-verification-check`
- Services/types for application, organization, public profile, Root review
- Account Center Business routes/pages
- Root Dashboard Business applications module
- Domain/storage contract tests + package scripts
- Docs under `docs/verification-business/` and `docs/audit/`

Unrelated brand/installer/tmp dirt left unstaged.

## 7. Business application lifecycle

Server RPCs enforce transition matrix, draft upsert, immutable submission snapshot, LEGAL_COPY_REQUIRED gate, applicant vs admin DTOs.

## 8. Organization / team lifecycle

`create_organization` (foundation) + invitation / ownership transfer / last-owner guard RPCs.

## 9. Invitation security

Token hash only; expiry; email match; replay clears hash; owner role invite blocked; rate limit.

## 10. Document storage

Private `business-verification-documents` bucket; server path; MIME allowlist; SVG/EXE rejected; malware pending fail-closed on approve.

## 11. Domain verification

Normalize + consumer domain reject + Edge fail-closed. **DOMAIN VERIFICATION E2E: BLOCKED** (provider/env).

## 12. Representative verification

No fake verified flag. Manual Root path + verification cases foundation. Provider PASS not invented.

## 13. Root review

Root Dashboard module + `is_root_owner` RPCs. Confirmation UI ≠ authorization.

## 14. Badge / entitlement reconciliation

Approve mints organization Business badge + `business_dashboard`. Suspend/revoke reconciles. User subject Business badge not granted.

## 15. Public Business profile

`/business/@:slug` allowlisted DTO; requires approved + active badge + published + org active. Empty products/posts are real empties.

## 16. RLS matrix

SQL contract tests present. **RLS pgTAP execution: BLOCKED** (local Docker engine unavailable / not ready).

## 17. Storage test evidence

`npm run business:storage:test` → PASS (contract). Live upload E2E not hosted.

## 18. Regression evidence

- Creator/Publisher regression → PASS  
- Verified domain + ad-free leak → PASS  
- `verification:badges:smoke` → FAIL (pre-existing string match expects `<VerifiedBadge verification=` without `userId`; DM still renders `VerifiedBadge` with verification prop — not introduced by Business files)

## 19. Build results

| Check | Result |
|---|---|
| typecheck | PASS |
| build:account | PASS |
| build:web | PASS |
| build:desktop | PASS |

## 20. Legal copy status

**LEGAL COPY REQUIRED** — five document versions seeded as `pending_legal`, not `active`. Submit gate BLOCKED until ops publish active legal text.

## 21. Hosted apply status

**HOSTED PRODUCTION APPLY: NOT DONE**  
Staging `ufmtvqtsklqsmqxefbbs` is not production.

## 22. Blockers

1. Dedicated production Supabase project  
2. Hosted migration / storage / RLS apply  
3. Malware scanner provider (pending remains fail-closed)  
4. Domain verification DNS/web provider E2E  
5. Legal copy approval  
6. Local Docker pgTAP  
7. Prior Verified blockers (Stripe, billing seed) unchanged  

## 23. Final verdict

**PRODUCTION CODE READY — HOSTED/EXTERNAL GATES BLOCKED**
