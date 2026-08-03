# Publisher Phase 1 production resume — final verdict

**UTC evidence:** `docs/audit/evidence/publisher-phase1-production-resume-2026-08-03T14-45-57Z/`
**Production:** `picom-production` / `cqnsetsmcduraryemhbi` / `eu-central-1`
**HEAD:** `c50f51a88c5dd841cb8c71304e6653d0b3ef6607`
**Candidate final tag:** `picom-publisher-phase1-production-candidate-2026-08-03-final` → `448736697acf44e36887740b613c1dab16df2c27`

## Realtime provisioning

Official Management API enablement (`presence_enabled=true`) + project restart provisioned platform relations within ~1 minute.

- `realtime.messages`: EXISTS (owner `supabase_realtime_admin`, partitioned, `rls_enabled=true`)
- `realtime.subscription`: EXISTS
- `realtime.schema_migrations`: EXISTS
- schema owner: `supabase_admin`
- No manual CREATE; no ownership changes

## Migration resume

- Dry-run: PASS (would push `20260710121000` … `20260803172000`)
- Apply: FAIL at `20260710121000`
- Error: `42501 must be owner of table messages` on `alter table realtime.messages enable row level security`
- Probe: ALTER fails; CREATE POLICY begin/rollback succeeds
- Supabase docs: RLS already default-on; ALTER not required; policies allowed
- Last applied: `20260710090000`
- Phase 1 `202608031*`: NOT_REACHED
- Hash freeze / repair / owner change: NOT USED

## Gates not reached

Auth/Storage/Realtime app config, workers, JWT/RLS, Case 04/18, revocation, reminders/preferences, 10-locale, controlled enablement: NOT_RUN

LiveKit: BLOCKED_CREDENTIAL (missing in `.env.production.local`)
Feature flags: ALL OFF
Production GO tag: NOT CREATED

## Operator unblock

Platform must make the no-op `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY` succeed for role `postgres` when RLS is already enabled (or equivalent privilege without ownership transfer). Then resume `db push` on `cqnsetsmcduraryemhbi` without repair/hash rewrite.

## Final

PICOM SUPABASE REALTIME PROVISIONING: GO
PICOM PRODUCTION MIGRATIONS: BLOCKED_AT_20260710121000
PICOM PRODUCTION AUTH: NOT_RUN
PICOM PRODUCTION STORAGE: NOT_RUN
PICOM PRODUCTION REALTIME: PARTIAL (platform tables GO; PICOM policies NOT_APPLIED)
PICOM PRODUCTION LIVEKIT: BLOCKED_CREDENTIAL
PICOM PRODUCTION WORKERS: NOT_RUN
PICOM PUBLISHER JWT/RLS: NOT_RUN
PICOM PUBLISHER CASE 04: NOT_RUN
PICOM PUBLISHER CASE 18: NOT_RUN
PICOM PUBLISHER REALTIME REVOCATION: NOT_RUN
PICOM PUBLISHER REMINDERS: NOT_RUN
PICOM PUBLISHER NOTIFICATION PREFERENCES: NOT_RUN
PICOM PUBLISHER 10 LOCALE: NOT_RUN
PICOM PUBLISHER PHASE 1 PRODUCTION: PARTIAL
