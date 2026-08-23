# PICOM Production Hosted Closure Preflight — TASK 08

Generated: 2026-08-04T00:15:00+02:00  
Branch: `feat/community-rebuild`  
HEAD at start: `3985945eadf722b43c3f5011749fe205e5f2c712`  
Release worktree: `C:/Users/ACER/Desktop/picom-production-task08` @ `3985945e` (clean)  
Production ref: `cqnsetsmcduraryemhbi`  
Staging ref: `ufmtvqtsklqsmqxefbbs`

## Gate matrix

| Gate | Required state | Detected state | Evidence | Safe to continue? | Result | Required action |
| --- | --- | --- | --- | --- | --- | --- |
| Git HEAD | `3985945e…` | Match | `git rev-parse HEAD` | Yes | PASS | — |
| Prod ≠ staging refs | Distinct | Distinct | `list_projects` | Yes | PASS | — |
| `.env.production` not staging | Production URL/ref | Was staging; corrected locally (gitignored) | classify script; config guard | Yes for local builds | PASS (local file) | Keep CI secrets aligned; do not commit secrets |
| `.env.production.example` | Documents production ref | Updated to `cqnsetsmcduraryemhbi` | tracked example | Yes | PASS | Commit example only |
| Production mutation env | All required vars SET | All MISSING | `production-mutation-guard` | **No hosted mutation** | **BLOCKED** | Operator must supply ticket/approval/token |
| Migration checksums vs manifest | LF SHA match | 21/21 match incl. sealed Task SHAs | worktree validate | Yes for static | PASS | — |
| Docker engine | Running | Server 29.4.2 after Desktop start | `docker info` | Yes for local | PASS | Service remains Disabled; Desktop process used |
| Clean `db reset` | Exit 0 through latest | Exit 1 | `.tmp-task08-db-reset*.log` | **No** | **FAIL** | See migration defects below |
| Additive view-drop `225000` | Fixes 42P16 | Applied; 230000 then OK | reset-2 log | Partial | PASS (partial) | Keep additive migration |
| Ads migration `240000` | Valid SQL | `as $` / `$;` invalid dollar quote | SQLSTATE 42601 statement 64 | **No** | **FAIL** | Explicit approval required to patch sealed file OR supersede process |
| Incremental upgrades | A/B/C PASS | Not completed (clean FAIL) | — | No | **BLOCKED** | After 240000 syntax fix |
| Local pgTAP/RLS | 0 failed | Not run (reset FAIL) | — | No | **BLOCKED** | After clean reset PASS |
| Local storage | Policy PASS | Not run | — | No | **BLOCKED** | After clean reset PASS |
| Backup / PITR | Evidenced | Not evidenced via MCP | `get_project` lacks backup fields | No | **BLOCKED** | Dashboard/API backup proof |
| Restore rehearsal | PASS | Not run | — | No | **BLOCKED** | After backup + clean chain |
| Hosted apply | Guard + pre-apply all PASS | Guards incomplete + chain FAIL | — | **No** | **BLOCKED** | Do not apply |
| Hosted RLS/storage/edge | Real JWT/deploy | Not started | — | No | **BLOCKED** | After apply |
| Provider/legal/worker | Out of scope | Still blocked | TASK 07 carry-forward | N/A | BLOCKED (unchanged) | Later tasks |

## Production mutation env (presence only)

| Variable | Configured |
| --- | --- |
| PICOM_ENVIRONMENT | no |
| SUPABASE_PRODUCTION_PROJECT_REF | no |
| SUPABASE_PRODUCTION_URL | no |
| SUPABASE_PRODUCTION_DB_HOST | no |
| SUPABASE_PRODUCTION_ORG_ID | no |
| SUPABASE_ACCESS_TOKEN / CI identity | no |
| PRODUCTION_CHANGE_TICKET | no |
| PRODUCTION_DEPLOY_APPROVED | no |
| EXPECTED_RELEASE_COMMIT | no |
| EXPECTED_MIGRATION_MANIFEST_SHA256 | no |

**HOSTED PRODUCTION MUTATION: BLOCKED**

## Clean reset defect detail

1. First reset: `20260803230000` → `SQLSTATE 42P16` cannot rename view column `sku` → `price_display_mode`.
2. Additive `20260803225000` drops foundation public product/post views → 230000 succeeds.
3. Second reset: `20260803240000` → `SQLSTATE 42601` at `ads_allow_internal_transition` because body uses `as $` … `$;` (single `$`, not `$$`). LF SHA still matches sealed `91b3d199…` — defect is in the sealed artifact.

Rewriting `240000` would change checksums and violates TASK 08 history freeze without explicit override.

## Tools

| Tool | Detected |
| --- | --- |
| Node | v24.15.0 |
| npm | 11.17.0 |
| Supabase CLI | 2.109.1 |
| Docker | client+server 29.4.2 (Desktop) |
| psql | not on PATH |
| com.docker.service | Stopped/Disabled (Desktop UI/process used) |
