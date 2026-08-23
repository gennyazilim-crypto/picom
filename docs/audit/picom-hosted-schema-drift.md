# PICOM Hosted Schema Drift — Read-only (TASK 07)

**Mode:** read-only audit only. No apply. Staging results are **not** treated as production.

| Field | Value |
| --- | --- |
| Branch | `feat/community-rebuild` |
| Base HEAD | `6603dd498744cf5df2d2013f6b5d5760f8d975c6` |
| Staging ref | `ufmtvqtsklqsmqxefbbs` |
| Production candidate ref | `cqnsetsmcduraryemhbi` |
| Mutation | BLOCKED (guards missing) |

## Summary

| Comparison | Severity | Notes |
| --- | --- | --- |
| Production vs local Task 02–07 migrations | **BLOCKING** | Production `schema_migrations` ends at `20260803173000`; local has through `20260803260000` |
| Staging vs local Task 01–07 monetization | **BLOCKING** | Staging lacks `20260803173000`+ Task chain; no `business_applications` / advertiser tables |
| Production vs staging history | **WARNING** | Histories diverged (staging missing 03100000/03110000/compat 135000–135300 versions; production has them) |
| Unexpected `ad_campaigns` on production without Task 05 migration version | **WARNING** | Relation observed; Task 05 (`20260803240000`) not in production migration history — investigate before apply |
| Legal active documents | **BLOCKING** for paid GO | No proven `active` legal document set on production |

## Migration history (Aug 2026 window)

### Production `cqnsetsmcduraryemhbi`

Present through publisher + foundation:

`20260803100000` … `20260803173000_verification_business_platform_foundation`

**Absent:** `20260803210000` … `20260803260000`

### Staging `ufmtvqtsklqsmqxefbbs`

Publisher chain present with gaps vs production (no `20260803100000` / `03110000` / compat `135000–135300` versions in history). Ends at `20260803172000`. **No** Task 01 foundation / Verified / ads / payout migrations.

## Object spot checks (read-only SQL)

| Object | Production | Staging |
| --- | --- | --- |
| `platform_account_restrictions` | present | present |
| `profiles.deactivated_at` | present | present |
| `business_applications` | present (foundation) | absent |
| `advertiser_accounts` | present (foundation) | absent |
| `ad_platform_settings` | absent | n/a |
| `partner_payout_batches` / payout settings | absent | absent |
| `feature_canary_allowlist` | absent (260000 not applied) | absent |

## Edge Functions / secrets / cron

Hosted Edge Function version inventory and secret **values** were not pulled into this report. Secret **names** are tracked in `docs/audit/production-secret-matrix.md` without values.

## Drift policy

- Do **not** auto-overwrite unexpected drift.
- Do **not** `repair` production history to match local without change ticket + backup gate.
- Hosted apply remains **BLOCKED** until production mutation guard + backup/restore + manifest SHA match.

## Severity legend used

- **INFO** — informational divergence without safety impact
- **WARNING** — must be explained before apply
- **BLOCKING** — prevents hosted apply / GO
- **SECURITY_CRITICAL** — stop and escalate (none newly confirmed as bypass in this read-only pass; hosted RLS not executed)
