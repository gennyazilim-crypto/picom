# Hosted Multi-Role Acceptance Report (Task 39)

## 1. Summary of what was implemented

Acceptance plan and evidence template for hosted verification of Panel across roles. **Execution against production/staging Supabase is conditional on migration apply** — this report records the required cases and current status.

### Required role personas

| Persona | Expectation |
|---------|-------------|
| root_owner (`f.tayboga@gmail.com` via user_id) | Panel visible; all modules; role grant with MFA |
| platform_admin | Broad ops; dual-control where matrix says A |
| support_agent | Support modules; denied finance mutate / SOC elevate |
| security_analyst | SOC triage; denied ads billing |
| moderator | T&S/content; no unrestricted DMs |
| finance_viewer | Revenue read; no approve exceptional refund |
| anonymous / normal user | No Panel; RPCs fail |

### Evidence checklist

| Case | Status |
|------|--------|
| Migrations applied on hosted DB | **PENDING** |
| Owner bootstrap row present | **PENDING** (requires Auth user + migrate) |
| Non-admin Panel denied | Local UI smoke covered; hosted JWT proof **PENDING** |
| Empty tables show empty UI | Implemented; hosted confirm **PENDING** |
| Cross-role denial matrix | Documented; hosted session matrix **PENDING** |
| MFA step-up on destructive | Blocked on `20260715141000_…` apply + AAL |

## 2. Files changed

- `docs/root-dashboard/HOSTED_MULTI_ROLE_ACCEPTANCE_REPORT.md`
- Supporting: Panel access services, matrices, operations migration

## 3. Migrations / RLS

Must apply:

1. `20260715140000_root_dashboard_operations_core.sql`
2. `20260715141000_root_dashboard_mutations_rbac_mfa.sql` (when ready)

Then re-test each persona with real JWTs.

## 4. APIs / realtime

Hosted tests must call `get_root_dashboard_overview_v1` / `list_root_dashboard_module_v1` under each session and assert error codes for denials.

## 5. Verification

Local: `npm run typecheck`; `node scripts/root-dashboard-ui-smoke.mjs`
Hosted: persona matrix above — **not complete until migrate**.

## 6. Security / privacy

Acceptance itself must use least-privilege test accounts; no copying production PII into tickets unnecessarily.

## 7. Remaining blockers

1. **Hosted migrations not applied**
2. **Owner Auth user must exist for bootstrap**
3. **MFA enrollment for owner before destructive acceptance**
4. **Stripe keys** only if revenue sync cases are in scope for the run

## 8. Next task

**Task 40 — Final Production Readiness** → `FINAL_ROOT_DASHBOARD_READINESS.md`
