# PICOM Live Now — Case 18 Discovery Closure Verdict

**Evidence dir:** `docs/audit/evidence/live-now-case18-closure-2026-08-03T10-35-27/`  
**Project:** `ufmtvqtsklqsmqxefbbs` (picom-staging)  
**Case 04:** untouched (no publisher eligibility / founder member-count changes)

## Result

| Gate | Status |
|------|--------|
| `18_live_now_includes_approved_stream` | **PASS** (via `list_publisher_live_now`, not raw table SELECT) |
| Negatives (pending app, suspended profile/badge, revoked/expired badge, not-live, private visibility, hidden, deleted, moderation blocked, broadcaster mismatch, search cannot bypass, featured N/A) | **PASS** |
| List/count consistency + category count + badge suspend/reactivate/end | **PASS** |
| Smoke RUN 1 | **23 PASS / 0 FAIL** (`04-fixture-run-1.log`) |
| Smoke RUN 2 | **23 PASS / 0 FAIL** (`05-fixture-run-2.log`) |
| Secret scan | **PASS_NO_SECRETS** |

## Product fix applied

Forward-only migration (pushed to staging):

`20260803170000_live_now_discovery_badge_join_dedupe.sql`

- `list_publisher_live_now` / `list_upcoming_publisher_schedules` use a **lateral** join selecting **one** allowlisted non-expired active badge per broadcaster.
- Prevents list/count fan-out if multiple badge rows exist; schema also enforces `publisher_badges_one_active_uidx` (one active badge per user).
- Does **not** alter Case 04 counting or `largest_owned_active_community_stats`.

## Fixture notes

- Stream table: `community_live_screen_sessions` (canonical Live Now row).
- Second live session uses a **separate channel** (`community_live_screen_sessions_active_channel_uidx`).
- Multi-badge check uses one active + one suspended badge (cannot insert two actives).
- Transaction + `ROLLBACK` — no durable staging pollution from smoke UUIDs.

## Verdict board

```
PICOM LIVE NOW CASE 18 DISCOVERY: GO
PICOM LIVE NOW SQL SMOKE: GO
PICOM LIVE NOW JWT/RLS RUNTIME: PENDING
PICOM LIVE NOW REALTIME REVOCATION: PENDING
PICOM LIVE NOW STAGING: PARTIAL
PICOM LIVE NOW PRODUCTION: BLOCKED
```
