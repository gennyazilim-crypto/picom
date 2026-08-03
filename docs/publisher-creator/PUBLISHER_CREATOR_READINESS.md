# Publisher / Creator — Readiness

**Date:** 2026-08-03  
**Canonical staging:** `picom-staging` / `ufmtvqtsklqsmqxefbbs`  
**Staging-v2 (unused for Phase 1):** `kbdotviopwlcqviggtrc`  
**Prior staging GO tag:** `picom-live-now-phase1-staging-go-2026-08-03`  
**Prior staging GO SHA:** `2f198ef61ffd0ac423c9713482c57da24c4967b7`  
**Production candidate tag:** `picom-publisher-phase1-production-candidate-2026-08-03`  
**Release manifest:** `docs/publisher-creator/PUBLISHER_CREATOR_PHASE1_RELEASE_MANIFEST.json`  
**Hardening evidence:** `docs/audit/evidence/publisher-phase1-final-hardening-2026-08-03T13-41-53Z/`

## Scorecard

| Area | Status | Notes |
|---|---|---|
| CODE | GO | Phase 1 Publisher/Creator + Live Now + 10-locale runtime |
| STAGING | GO | Canonical `ufmtvqtsklqsmqxefbbs` only |
| 10_LOCALE_RUNTIME | GO | `en tr de fr es it pt ru ar ja`; Arabic RTL |
| MIGRATION_HISTORY | GO | Eight Phase 1 migrations `APPLIED_AND_MATCHED` including `20260803141000` |
| EVIDENCE_INTEGRITY | GO | Manifest binds packages to release SHA + migration hashes |
| PRODUCTION_CONFIG_SAFETY | GO | Fail-closed guard blocks staging refs / placeholders |
| PRODUCTION_INFRASTRUCTURE | NOT_CREATED | No separate production Supabase project yet |
| PRODUCTION_BUILD | BLOCKED_EXPECTED | `npm run build:production` fails until real production config |
| PRODUCTION_DEPLOY | BLOCKED_EXPECTED | Intentionally blocked |
| MONETIZATION | BLOCKED | No billing provider |
| LINT | NOT_CONFIGURED | No lint script in package.json |

## Migration inventory (canonical staging)

| Version | Status | SHA-256 |
|---|---|---|
| 20260803130000 | APPLIED_AND_MATCHED | d2092cd45ba24619769dc7da1b093e64b71eff353e24b0bedcd1761710c110ff |
| 20260803140000 | APPLIED_AND_MATCHED | 9d7314a9e5b43decf1cdb53eddffcd03a53ad2cccf6a11cc357905b5e0026806 |
| 20260803141000 | APPLIED_AND_MATCHED | 23439706df674fcbbab7deebf2c4dbf6bac9bd356c8e8c31d60b91f5cc3ed5f9 |
| 20260803150000 | APPLIED_AND_MATCHED | b6ae5107eb70d8f34d9d3f745a2511c9743e4fefac0eab486322b362c2d4c4e3 |
| 20260803160000 | APPLIED_AND_MATCHED | 208a648ca142fa75ae187731d14cef3dcc7ca7c1fc7970097f22a18fbf33e0b9 |
| 20260803170000 | APPLIED_AND_MATCHED | 6f3aea432eedbbd28b80965a77422762463de9bf34b6137ae139508457bd59ee |
| 20260803171000 | APPLIED_AND_MATCHED | 47f31b9125e8481d577dd9545ea8da789400037e09c73fe3dcc18f514c2ac7cc |
| 20260803172000 | APPLIED_AND_MATCHED | 1ed726cf4432b44c2889e92c8637a7d1065d7eeb3c3582c23eda17cc3d06a54b |

## Evidence map

| Package | Relation | Covers |
|---|---|---|
| `live-now-case18-closure-2026-08-03T10-35-27/` | pre-release | Case 18 |
| `live-now-jwt-rls-revocation-2026-08-03T11-14-25-871Z/` | pre-release | JWT/RLS + realtime badge revocation |
| `live-now-staging-final-closure-2026-08-03T11-43-48Z/` | pre-release | reminders, notification preferences, staging closure |
| `picom-publisher-live-now-full-audit-2026-08-03T12-50-15Z/` | post-release audit | consolidated audit around freeze SHA |
| `publisher-phase1-final-hardening-2026-08-03T13-41-53Z/` | production candidate | locales, migration seal, config guard, local gates |

Older evidence packages may cite SHAs earlier than `2f198ef6`; that is expected and not hidden. Hosted Case 04/18/JWT/realtime/reminder/notification smokes were not re-fixture'd during hardening because schema objects matched and no forward migration was applied.

## Production branch-omission note (2026-08-03)

Root cause of production stop at `20260803140000`:

1. `20260803100000_community_live_screen_sessions.sql` and required follow-on `20260803110000_go_live_broadcast_start.sql` existed on `release/homepage-platform-stats-prerequisites` but were omitted from `feat/community-rebuild`.
2. `20260803130000` could apply without the live-session table (function body reference only).
3. `20260803140000` fail-closed with `42P01` because it alters `public.community_live_screen_sessions`.
4. Canonical staging has the live-session schema (including go-live columns) but **no** history rows for `20260803100000` / `20260803110000` (schema matched, history gap).
5. No migration repair and no manual SQL apply were used; restore is exact byte-for-byte from source commits, then normal Supabase `db push --include-all`.

## Verdict lines

```text
PICOM PUBLISHER/CREATOR PHASE 1 CODE: GO
PICOM PUBLISHER/CREATOR PHASE 1 STAGING: GO
PICOM PUBLISHER/CREATOR 10 LOCALE RUNTIME: GO
PICOM PUBLISHER/CREATOR MIGRATION HISTORY: GO
PICOM PUBLISHER/CREATOR EVIDENCE INTEGRITY: GO
PICOM PRODUCTION CONFIG SAFETY: GO
PICOM PRODUCTION INFRASTRUCTURE: CREATED_PARTIAL_SCHEMA
PICOM PRODUCTION DEPLOY: PARTIAL
PICOM PUBLISHER MONETIZATION: BLOCKED
PICOM PHASE 1 PRODUCTION CANDIDATE: GO
```

## Operator next steps

1. Keep production feature flags fail-closed until runtime smokes pass.
2. After live-screen dependency restore + include-all apply, seal Phase 1 migrations then run JWT/Case/LiveKit gates.
3. Monetization remains out of Phase 1 scope.
4. Do not reuse staging refs in production config (guard must pass).

## Runtime remote closure (2026-08-03)

- Production migrations applied from original canonical tree.
- Sanitized remote branch carries the same product and migration tree.
- Difference is only GitHub-rejected generated binary history.
- Migration file SHA-256 values are unchanged.
- Verdict: PARTIAL_LIVEKIT_PENDING (Go Live OFF).
- Evidence: docs/audit/evidence/publisher-phase1-runtime-and-remote-closure-20260803T212618Z
