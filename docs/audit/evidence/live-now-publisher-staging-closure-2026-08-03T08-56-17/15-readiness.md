# PICOM Live Now Publisher Staging Closure — Readiness

Evidence dir: docs/audit/evidence/live-now-publisher-staging-closure-2026-08-03T08-56-17/
Project ref: ufmtvqtsklqsmqxefbbs (staging only; no production ops)

## 1. Migration history
PASS — 20260803130000 / 140000 / 141000 / 150000 present in:
- supabase migration list --linked
- supabase_migrations.schema_migrations
- pg_proc objects for list/count_publisher_live_now, live_session_is_publisher_discovery_eligible, largest_owned_active_community_stats
No history gap. No re-apply. No repair migration.

## 2. Case 04 root cause
Prior FAIL was a **smoke predicate bug**, not product threshold bug:
- Old smoke looked for `owner_id` inside `get_publisher_application_eligibility` body.
- Canonical founder field is `communities.owner_id` inside `largest_owned_active_community_stats`.
- Membership counted via `is_active_community_media_member` (owner is NOT auto +1).
- Unit thresholds 10/10 PASS (2999 denied, 3000 allowed, OR paths, no aggregation).
- Schema smoke after fix: 04 PASS (wiring).
- Volume behavioral SQL (2999/3000/3001 inserts): **NOT EXECUTED** — staging login-role timeouts (544/503). Marked PENDING.

## 3. Case 18 root cause
Prior FAIL was a **smoke predicate bug**, not discovery RPC bug:
- Old smoke required `user_has_active_publisher_badge` literal in `live_session_is_publisher_discovery_eligible`.
- Actual gate: `user_can_broadcast_on_picom_live` + `public_discovery` + moderation approved + not deleted/hidden.
- Schema smoke after fix: 18 PASS (wiring).
- Behavioral list_publisher_live_now fixture proof: **NOT EXECUTED** (same login-role timeout).
- JWT runtime list/count/suspend: **FAIL** — `auth.admin.createUser` returned empty error `{}` (service-role/API). SECURITY PENDING.

## 4. Fixture idempotency
- Schema smoke is begin/rollback, no profile inserts → re-runnable.
- Run1 initially 503 (infra); rerun EXIT 0 all PASS.
- Run2 EXIT 0 all PASS.
- RUN_1_EXIT=0 (rerun) RUN_2_EXIT=0 — same case set PASS.
- Full volume fixture script prepared: scripts/publisher-live-now-behavioral-sql-smoke.sql (unique UUIDs + ROLLBACK) — blocked by staging DB login role timeouts.

## 5. JWT/RLS + realtime revoke
PENDING/FAIL — createUser failed; badge revoke realtime path not proven on staging this run.
Client still subscribes to publisher_badges + sessions for invalidation (code path exists).

## 6. Typecheck
GO — voiceService Uint8Array copy fix; `npm run typecheck` EXIT 0.

## 7. i18n
PARTIAL — Canonical `UiLanguage` / catalogs in repo are **en|tr only**. No 10-locale config found (do not invent). Live Now en/tr parity tests PASS. feed:i18n:parity script crashed (typescript ModuleKind undefined) — audit PARTIAL.

## 8. Reminder / notification preference
NOT_IMPLEMENTED — no publisher schedule reminder table / card notification preference backend in Phase 1 scope for this closure. Toast stub remains. Do not mark PASS.

## 9. Monetization
BLOCKED

## Verdicts
PICOM LIVE NOW PUBLISHER ALIGNMENT CODE: GO
PICOM LIVE NOW STAGING MIGRATION: GO
PICOM LIVE NOW SQL SMOKE: PARTIAL (schema wiring GO; volume behavioral PENDING)
PICOM LIVE NOW JWT/RLS SECURITY: PENDING
PICOM LIVE NOW REALTIME REVOCATION: PENDING
PICOM LIVE NOW I18N: PARTIAL
PICOM REPOSITORY TYPECHECK: GO
PICOM LIVE NOW STAGING: BLOCKED
PICOM LIVE NOW PRODUCTION: BLOCKED
PICOM PUBLISHER MONETIZATION: BLOCKED
PICOM REPOSITORY RELEASE GATE: GO (typecheck green; npm run lint script absent)

## Command matrix
See 00-command-matrix.txt
