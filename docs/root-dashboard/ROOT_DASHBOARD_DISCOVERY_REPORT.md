# Root Dashboard Discovery Report (Task 01)

**Date:** 2026-07-15
**Scope:** Repository map for the owner root dashboard (Claude tasks 01–40).
**Owner bootstrap identity (not authorization):** `f.tayboga@gmail.com`

## 1. Summary of what was implemented

This task is discovery-only. No new dashboard modules were shipped here. The investigation mapped how Picom today authorizes admins, what schemas and RPCs already exist, where Admin Operations lives, how analytics and media (radio/podcast/voice) surface, and what gaps block a real-data Panel.

Subsequent work (this session) delivered operational migration `20260715140000_root_dashboard_operations_core.sql`, Panel UI under `src/components/rootDashboard/`, Settings → Panel redirect, and overview/module list RPCs. Mutation/RBAC/MFA hardening continues in `20260715141000_root_dashboard_mutations_rbac_mfa.sql` (in progress).

## 2. Files changed

Discovery artifacts only:

- `docs/root-dashboard/ROOT_DASHBOARD_DISCOVERY_REPORT.md` (this file)
- `docs/root-dashboard/ROOT_DASHBOARD_SCOPE_LOCK.md`

## 3. Migrations / RLS

Audited (not authored in task 01):

| Asset | Role |
|-------|------|
| `public.app_admins` + `is_app_admin()` | Existing app-admin gate used by Admin Operations |
| `public.root_owners` + `is_root_owner()` | Added in `20260715140000_…` — user_id allowlist |
| `platform_role_catalog` / `platform_role_assignments` / `has_platform_role()` | RBAC foundation |
| Operational tables | `support_tickets`, `ad_campaigns`, `subscription_records`, `finance_approval_requests`, `platform_incidents`, `remote_feature_flags` — RLS enabled, privileges revoked from `anon`/`authenticated` (SECURITY DEFINER RPCs only) |
| Analytics | `analytics_events`, queue/processor, PII sanitize, data-quality runs |
| Voice | LiveKit sessions/events, `authorize_livekit_*` RPCs, webhooks |

## 4. APIs / realtime

| Area | Finding |
|------|---------|
| Auth | Supabase Auth session; client must not treat email as proof of root |
| Admin Operations | `adminOperationsService` + Settings panels; fail-closed |
| Root Panel access | `rootDashboardAccessService` → `adminOperationsService.getAccess()` |
| Overview | `get_root_dashboard_overview_v1()` — presence, optional DAU/WAU/MAU, support/ads/revenue/incident aggregates |
| Module lists | `list_root_dashboard_module_v1(module_name, …)` cursor pages |
| Summaries | `get_root_dashboard_module_summary_v1` |
| Edge | `livekit-token` and related LiveKit functions exist for product voice, not yet a dedicated root SOC channel |
| Realtime | Product channels exist; dashboard-specific postgres_changes subscriptions are planned (task 35), not fully rolled out on every module |

## 5. Verification

| Check | Status |
|-------|--------|
| Discovery complete against current tree | Done |
| `npm run typecheck` | Expected for follow-on implementation tasks |
| `node scripts/root-dashboard-ui-smoke.mjs` | Panel UI smoke for shell/nav |

## 6. Security / privacy

- Root must be proved by `auth.uid()` ∈ `root_owners` (and/or `is_app_admin` / role assignments), never by comparing client-supplied email strings.
- Bootstrap migration looks up `auth.users` for `f.tayboga@gmail.com` and inserts `user_id` into `root_owners`, `app_admins`, and `platform_role_assignments`.
- Operational tables revoke direct table grants; access is RPC/`security definer` gated.
- Analytics path includes metadata PII redaction and consent categories.
- Gaps: MFA step-up for destructive mutations, immutable mutation audit on every privileged write, hosted multi-role RLS proofs.

## 7. Remaining blockers

Hard blockers only:

1. **Migration apply:** `20260715140000_root_dashboard_operations_core.sql` (and follow-on `20260715141000_…`) must be applied to the hosted Supabase project before production Panel use.
2. **Owner account existence:** bootstrap `DO` block is a no-op until `f.tayboga@gmail.com` exists in `auth.users`.
3. **Stripe / billing provider keys** (when revenue sync is enabled): must be present in env for provider reconciliation — not fabricated MRR.

## 8. Next task

**Task 02 — Root Owner Bootstrap and Identity** → `ROOT_OWNER_BOOTSTRAP_REPORT.md`

---

## Implementation map

### Auth & identity

- Electron + React + TypeScript client; Supabase Auth session in `App.tsx`.
- App admin: `is_app_admin()` / `app_admins`.
- Root owner: `root_owners` + `is_root_owner()`.
- Platform roles: catalog + assignments + `has_platform_role(target_role)`.

### Sidebar / Panel entry

- `GlobalAppSidebar.tsx` hosts `PanelEntryButton`.
- `PanelEntryButton` respects `accessStatus`; unauthorized users do not get a working Panel entry.
- `App.tsx` `activeView === "rootPanel"` mounts `RootDashboardApp`.
- Settings Admin Operations redirects via `AdminOperationsPanelRedirect` → `onOpenPanel` → `openRootPanel`.

### Existing admin ops

- `AdminOperationsPanel.tsx` / `AdminOperationsView.tsx` / `AdminOperationsV2Sections.tsx`
- Infrastructure probe (DB, LiveKit, TURN, Redis) — admin-gated, honest unavailable states.

### Schemas relevant to Panel modules

| Domain | Primary sources |
|--------|-----------------|
| Users / profiles | `profiles`, auth users |
| Communities | community tables + RLS |
| Content / feed | posts/feed tables + moderation |
| DMs | conversation tables; safety via reports/abuse — content minimized |
| Voice | LiveKit sessions/events |
| Support | `support_tickets` + role assignments |
| Ads | `ad_campaigns` |
| Revenue | `subscription_records`, `finance_approval_requests` |
| Incidents / flags | `platform_incidents`, `remote_feature_flags` |
| Audit | `admin_operations_audit` surfaced as `audit_logs` module |
| Analytics | `analytics_events` + warehouse-dependent DAU/WAU/MAU |

### Gaps (honest)

- Deep CRUD/workflows for tickets, campaign pacing, sanction limits, appeal separation — role matrices defined; mutation migration in progress.
- Radio/podcast/notification ops UIs exist under `rootDashboard/modules/`; backend depth varies.
- No fake metrics: empty tables → empty UI; analytics unavailable → `analyticsAvailable: false` / null DAU series.

### Recommended order (executed)

01 Discovery → 02 Bootstrap → 03 RBAC → 04 Panel routing → 05 IA → 06–07 Analytics → 08 Overview → 09–38 modules → 39 Hosted acceptance → 40 Readiness.
