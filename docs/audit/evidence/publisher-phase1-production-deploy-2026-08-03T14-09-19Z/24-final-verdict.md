# PICOM Publisher/Creator Phase 1 — production deploy verdict

**Evidence:** `docs/audit/evidence/publisher-phase1-production-deploy-2026-08-03T14-09-19Z/`  
**Final candidate tag:** `picom-publisher-phase1-production-candidate-2026-08-03-final` → `44873669`  
**Production project:** `picom-production` / `cqnsetsmcduraryemhbi` / `eu-central-1`

## What completed
- Production Supabase project created (after pausing unused staging-v2 to free free-plan slot)
- Production config guard PASS against gitignored `.env.production.local`
- Staging refs still fail-closed
- Migration dry-run PASS; apply progressed through `20260710090000` (57 versions)
- Fail-closed Publisher feature flags added (OFF in production)
- Rollback runbook + production identity doc sealed

## Hard blocker
`20260710121000` requires `realtime.messages`. On this new project the `realtime` schema is owned by `supabase_admin` and `postgres` cannot CREATE tables there. Bootstrap attempts via Management API and direct postgres connection failed with `permission denied for schema realtime`.

Phase 1 Publisher migrations (`202608031*`) were **not reached**.

## Verdict

```text
PICOM PRODUCTION PROJECT: GO
PICOM PRODUCTION CONFIG: GO
PICOM PRODUCTION MIGRATIONS: PARTIAL_BLOCKED_PLATFORM_REALTIME
PICOM PRODUCTION AUTH: BLOCKED
PICOM PRODUCTION STORAGE: BLOCKED
PICOM PRODUCTION REALTIME: BLOCKED
PICOM PRODUCTION LIVEKIT: BLOCKED_CREDENTIAL
PICOM PRODUCTION WORKERS: BLOCKED
PICOM PRODUCTION MONITORING: PARTIAL
PICOM PUBLISHER JWT/RLS: NOT_RUN
PICOM PUBLISHER CASE 04: NOT_RUN
PICOM PUBLISHER CASE 18: NOT_RUN
PICOM PUBLISHER REALTIME REVOCATION: NOT_RUN
PICOM PUBLISHER REMINDERS: NOT_RUN
PICOM PUBLISHER NOTIFICATION PREFERENCES: NOT_RUN
PICOM PUBLISHER 10 LOCALE: CODE_GO_PROD_SMOKE_NOT_RUN
PICOM PUBLISHER APPLICATIONS: BLOCKED
PICOM PUBLISHER GO LIVE: BLOCKED
PICOM PUBLISHER PHASE 1 PRODUCTION: PARTIAL
PICOM PUBLISHER MONETIZATION: BLOCKED
```

## Operator unblock
1. Have Supabase platform provision `realtime.messages` (Realtime Authorization / supabase_admin).
2. Resume `supabase db push --linked` on `cqnsetsmcduraryemhbi`.
3. Re-run Phase 1 seal + JWT/Case04/Case18/realtime/reminder smokes.
4. Configure production LiveKit + workers.
5. Controlled feature-flag enablement only after those gates PASS.
