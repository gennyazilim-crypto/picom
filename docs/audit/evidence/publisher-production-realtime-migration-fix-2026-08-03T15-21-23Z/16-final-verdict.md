# Publisher production realtime migration fix — final verdict

**Evidence:** `docs/audit/evidence/publisher-production-realtime-migration-fix-2026-08-03T15-21-23Z/`
**Commit:** `0c90fa5fb25bfbce7d4c219361f0461b37e20a2a`
**Tag:** `picom-publisher-phase1-production-candidate-2026-08-03-realtime-fix`

## Portability fix

- Patched `20260710121000_multi_tenant_realtime_storage_hardening.sql`
- Replaced redundant `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY` with fail-closed RLS assertion
- Policy semantic hash: MATCH
- legacyStagingSha256: `6c7fbfc4a8aac4829f2d4a6d6ae170b6ee537652991e101eb50e03e17b2d4bd8`
- canonicalPortableSha256: `6cac3fc152f34cd3ae433630747a7e2b3d1bf6abfafddc32a9bea78fce5b389a`
- Staging equivalence: PASS
- Capability probe: PASS
- Production apply of patched migration: PASS (`APPLIED_CANONICAL_MATCHED`)
- Picom realtime policies present on production

## Resume progress

- Applied through: `20260803130000`
- Failed at: `20260803140000_publisher_creator_program_core.sql`
- Error: `42P01` `public.community_live_screen_sessions` does not exist
- Missing prerequisite migration on this branch: `20260803100000_community_live_screen_sessions.sql`
- Present on: `release/homepage-platform-stats-prerequisites` @ `3d54872d`

## Final

PICOM REALTIME PLATFORM PROVISIONING: GO  
PICOM REALTIME MIGRATION PORTABILITY FIX: GO  
PICOM STAGING LEGACY SCHEMA EQUIVALENCE: GO  
PICOM PRODUCTION MIGRATION RESUME: PARTIAL  
PICOM PRODUCTION MIGRATION HISTORY: PARTIAL  
PICOM PUBLISHER PHASE 1 MIGRATION SEAL: NOT_REACHED  
PICOM PUBLISHER PHASE 1 PRODUCTION: PARTIAL  

Next blocker: restore/merge missing `20260803100000_community_live_screen_sessions.sql` into this branch, then resume production `db push` (no repair).
