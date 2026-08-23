# Publisher / Creator — Test report

**Date:** 2026-08-03  
**Phase:** 1

## Security review fixes (pre-staging)

- `dashboard.read` no longer grants approve/reject (`can_review_publisher_applications`); list-only uses `can_list_publisher_applications`
- `start_community_live_screen_broadcast` 10-param overload dropped/recreated with publisher gate + schedule metadata
- Storage insert requires an open application
- Approve status transitions constrained

## Automated (repo)

| Suite | Status | Evidence |
|---|---|---|
| Unit: eligibility thresholds (4999/5000, 2999/3000, OR, no community sum) | PASS (10/10) | `scripts/publisher-eligibility-thresholds.test.mjs` |
| SQL smoke checklist | Checklist ready (needs staging apply) | `scripts/publisher-eligibility-sql-smoke.sql` |
| Go-Live preflight publisher gate | Wired in UI model | `goLiveModel.ts` + `GoLiveWorkspace.tsx` |
| Full RLS integration against live staging | PENDING | Requires migrations applied to `ufmtvqtsklqsmqxefbbs` (or current staging) |
| Packaged E2E for publisher apply → Root approve → Go Live | PENDING | Blocked until staging migrations + fixture users |

## Boundary expectations (server)

- 4999 followers → not eligible  
- 5000 followers → eligible via `follower_threshold`  
- 2999 founder members → not eligible  
- 3000 founder members → eligible via `community_founder_threshold`  
- Separate communities never summed  
- Client-supplied eligibility fields ignored  

## Manual QA (post-migrate)

1. Ineligible user: apply CTA shows progress; submit fails with `PUBLISHER_APPLICATION_NOT_ELIGIBLE`  
2. Eligible user: submit succeeds; status `submitted`; no badge yet; Go Live preflight fails publisher check  
3. Root review approve → badge + profile active → Go Live allowed  
4. Live Now: non-publisher `public_discovery` session not listed for strangers  
5. Settings Account: “Creator/Publisher’a geç” opens apply; Publisher Dashboard deny shell when not approved  

## BLOCKED / not tested (honest)

- Subscriptions, donations, ads, payouts  
- Clip/replay transcoder  
- Rich analytics  
- RTMP ingest credentials  
- Fraud ML  
