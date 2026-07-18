# Root / Admin Dashboard — SECURITY BLOCKERS (found 2026-07-18)

> 🔴 **DO NOT enable admin/root dashboard operations for real staff until #1 and #2 are fixed.**
> Found in a focused security review of `src/services/rootDashboard/**` + migrations
> `20260715141100_root_dashboard_mutations_rbac_mfa.sql`, `20260715140100_root_dashboard_operations_core.sql`.
> The mutation-authorization layer is otherwise sound (every write RPC re-checks a specific
> permission server-side via `assert_root_dashboard_permission`; role grants can't self-escalate to
> root; privileged tables are `revoke all` + RLS). These two are the exceptions.

## 🔴 #1 CRITICAL — broken per-module READ authorization (IDOR: any staff role reads every module)
`list_root_dashboard_module_v1` (migration `20260715141100...`, guard ~lines 1437-1440):
```sql
if not public.has_platform_permission(required_perm)
   and not public.has_platform_permission('dashboard.read') then
  raise exception 'APP_ADMIN_REQUIRED' using errcode = '42501';
end if;
```
This is `allow if (has required_perm) OR (has dashboard.read)`. **Every** seeded staff role
(`moderator`, `support_agent`, `ads_reviewer`, `analytics_viewer`, `finance_viewer`, …) is granted
`dashboard.read`, so the `or dashboard.read` fallback nullifies the entire fine-grained matrix. A
`moderator` can call `list_root_dashboard_module_v1('finance_approvals' | 'audit_logs' |
'role_assignments' | 'dm_safety_reports' | …)` and read finance queues, the privileged-action audit
log, and the full staff role/permission map. Reachable from the client via
`rootDashboardOperationsService.listModule` with only `module_name` changed. Same weaker pattern in
`get_root_dashboard_command_search_v1` (~1851-1854).

**Fix:** drop the `or public.has_platform_permission('dashboard.read')` fallback from BOTH functions;
require only `required_perm`. `has_platform_permission` already returns true for
`is_app_admin/is_root_owner/platform_admin`, so no escape hatch is lost. (Forward-only
`create or replace` of the two functions, body unchanged except that guard. Deploy to ufmtv.)

## 🔴 #2 CRITICAL — "step-up / MFA" has no real second factor (security theater)
`confirm_privileged_step_up` (migration `20260715141100...`, ~lines 417-462) only checks the
challenge belongs to `auth.uid()`, is unconfirmed, and unexpired — then sets `confirmed_at = now()`.
**No TOTP / WebAuthn / password re-entry / `aal2` check** anywhere (grep for `aal2`, `mfa_factors`,
`totp` across the repo → zero hits). The client (`src/services/rootDashboard/rootDashboardStepUp.ts`,
`withPrivilegedStepUp`) auto-orchestrates create→confirm→retry with **no user prompt**. So a caller
holding the write permission — including one with a stolen/leaked session (XSS, token exfil,
compromised admin machine) — defeats step-up with 3 RPC calls using only the credential they already
have. Defeats step-up on finance approvals, `assign/revoke_platform_role`, and the `flags.kill_switch`
gate. (Nonce mechanics themselves are correct — scoped to `auth.uid()`, 5-min expiry, consumed on use;
the flaw is that "confirmation" proves nothing beyond the session already in hand.)

**Fix:** `confirm_privileged_step_up` must require a genuine second factor before setting
`confirmed_at` — e.g. require `auth.jwt()->>'aal' = 'aal2'` (client elevates via Supabase Auth
`mfa.challengeAndVerify` TOTP/WebAuthn before calling), or verify an out-of-band OTP the stolen JWT
alone cannot produce.

## 🟠 #3 MEDIUM (correctness, fails-closed) — feature-flag step-up action-key mismatch
`src/components/rootDashboard/modules/FeatureFlagsPage.tsx:34` mints step-up under `"flags.write"`,
but `upsert_remote_feature_flag` consumes `require_or_consume_step_up('flags.kill_switch', …)` for
kill/emergency flags → the challenge never matches → **kill-switch/emergency toggles perpetually fail**
(`STEP_UP_REQUIRED`). Not exploitable (fails closed), but breaks incident-response kill switches.
**Fix:** use `"flags.kill_switch"` client-side for kill/emergency flag writes (verify the normal-flag
path still uses the action key its RPC branch expects before changing).

---
**Deploy note:** #1 and #2 fixes are SQL/MFA changes on the app backend `ufmtvqtsklqsmqxefbbs`
(Codex-managed; not reachable from this environment). The admin dashboard is currently gated
(`enableAdminOperations: false` in client-config), but #1 is enforced by the RPC, not the UI flag —
so it is exploitable by any staff account the moment staff roles exist, regardless of the UI gate.
