# PICOM Business Application — Preflight

**Date:** 2026-08-03  
**Branch:** `feat/community-rebuild`  
**HEAD:** `575b8af4125771a92b285110a8864ca3d1e073c9`  
**Prior verified commits:** `4533587d` (foundation, mixed), `042d5f72` (Verified), `575b8af4` (Verified docs)

## Dirty tree policy

Unrelated brand/installer/tmp/`vite.config.web.ts` dirt present. Do not stage.

## Mapping

| Required concept | Existing canonical | Missing | Planned additive |
|---|---|---|---|
| Organization | `organizations`, `create_organization` | Rate limit, reserved name abuse, audit | Extend create + rate table |
| Members / roles | `organization_members` + role check | Last-owner guard, ownership transfer | Transfer table + RPC |
| Invitations | `organization_invitations` | Token hash, declined/revoked, replay | Additive columns + accept RPC |
| Business application | `business_applications` + status history | Extra representative fields, snapshot, risk | ALTER + submissions table |
| Application submit | `submit_business_application` | Draft autosave, immutable snapshot, idempotency | New draft/submit RPCs |
| Review / approve | `review_business_application` | Atomic badge+entitlement, transition matrix, malware gate | `approve_business_application` |
| Documents | none (publisher has private bucket pattern) | Business docs + scan status | `business_application_documents` + bucket |
| Domain verification | none | DNS/email/meta challenges | `business_domain_verifications` (fail-closed) |
| Representative verification | `verification_cases` | Business-specific case type wiring | RPC + case type |
| Business badge | `verification_badges` badge_kind=`business` | Approve path may not mint | Reconcile in approve txn |
| Entitlement | `account_entitlements` `business_dashboard` | Approve path may not grant | Grant in approve txn |
| Public profile | `business_profiles`, public views | Followers | `business_profile_followers` |
| Brand assets | `brand_assets` | Upload session Edge | Edge upload-session + SVG policy |
| Root dashboard | Publisher review module pattern | Business review modules | New Root routes + services |
| Web apply/dashboard | none | Full apply + dashboard routes | Account/web SPA routes |
| Storage signed URL | Publisher documents pattern | Business bucket policies | Mirror private bucket |
| Email outbox | `enqueue_email_for_user_event` | Business event templates | Outbox enqueue from RPCs |
| Legal copy | Unknown / likely missing | Partner terms acceptance | Acceptance table + LEGAL COPY REQUIRED gate |
| Hosted / Docker | Staging only; Docker blocked previously | Production project | Keep NOT DONE / BLOCKED |

## Preserved blockers (do not fake-resolve)

1. Stripe test-mode credentials (Verified)  
2. Dedicated production Supabase project  
3. Local Docker pgTAP may remain BLOCKED  
4. billing_products price seed  
5. Hosted production apply NOT DONE  
6. Malware scanner provider may be absent → pending fail-closed  
7. Domain fetch E2E may be BLOCKED without egress/config  
8. Legal partner terms copy may be LEGAL COPY REQUIRED  

## Next migration

`20260803220000_business_application_verification_and_team_management.sql`
