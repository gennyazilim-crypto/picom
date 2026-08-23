# PICOM Live Now JWT/RLS + Realtime Revocation

**Evidence:** `docs/audit/evidence/live-now-jwt-rls-revocation-2026-08-03T11-14-25-871Z`  
**SUMMARY:** pass=27 fail=0 **exit=0**

## Flow results

| Step | Result |
|------|--------|
| 1 Creator starts approved live | PASS |
| 2 Viewer list/count/search/featured | PASS |
| 3 Reviewer suspends badge | PASS |
| 4 Realtime UPDATE → rediscovery hides card/count/search/featured | PASS (`publisher_badges` UPDATE) |
| 5 Go Live + LiveKit authorize + restart denied | PASS |
| 6 Viewer reconnect still hidden | PASS |
| 7 dashboard.read-only list ok / approve+suspend denied | PASS |
| 8 User cannot forge badge/application status | PASS |

## Fix applied (forward-only)

`20260803171000_live_now_badge_realtime_revocation.sql`

- Added `publisher_badges` + `publisher_profiles` to `supabase_realtime`
- Widened SELECT so viewers still receive suspend/revoke UPDATE events (discovery RPCs remain eligibility authority)

Prior run (`…T11-05-42…`) failed only on realtime delivery (exit 1); rediscovery already hid the stream.

Case 04 / Case 18: untouched.

```
PICOM LIVE NOW JWT/RLS RUNTIME: GO
PICOM LIVE NOW REALTIME REVOCATION: GO
PICOM LIVE NOW STAGING: PARTIAL
PICOM LIVE NOW PRODUCTION: BLOCKED
```
