# Dashboard Information Architecture (Task 05)

## 1. Summary of what was implemented

Panel shell organizes owner operations into six nav groups with thirty-plus routes. Composition: left module nav, main content, global filter bar, KPI/table/chart primitives, and shared loading/empty/error/permission states (`DashboardState`).

Visual language reuses Picom charcoal / cool-gray / teal tokens (`rootDashboard.css`), informed by Astral admin reference docs without fake metrics.

## 2. Files changed

- `src/components/rootDashboard/navigation/rootDashboardNav.ts`
- `src/components/rootDashboard/RootDashboardShell.tsx`
- `src/components/rootDashboard/RootDashboardApp.tsx`
- `src/components/rootDashboard/rootDashboard.css`
- `src/components/rootDashboard/components/*` (KPI, table, chart, filters, states)
- `src/components/rootDashboard/modules/*`
- `docs/root-dashboard/DASHBOARD_INFORMATION_ARCHITECTURE.md`
- `docs/root-dashboard/ASTRAL_ADMIN_REFERENCE.md` (reference)

## 3. Migrations / RLS

IA is frontend structure; data gates remain RPC/RLS from operations core migration.

## 4. APIs / realtime

Routes map to module pages that call:

- `get_root_dashboard_overview_v1`
- `list_root_dashboard_module_v1`
- `get_root_dashboard_module_summary_v1`
- Existing admin infrastructure probes where System Health needs them

## 5. Verification

Smoke navigates primary routes without fabricated numbers. Empty DB → honest empty modules.

## 6. Security / privacy

Nav labels are not permissions. Module RPCs enforce admin/root. Sensitive modules (DM safety) designed around metadata / reports.

## 7. Remaining blockers

None specific to IA beyond hosted migration for live data.

## 8. Next task

**Task 06 — Realtime Analytics Event Foundation** → `ANALYTICS_EVENT_SCHEMA.md`, `TASK_06_ANALYTICS_FOUNDATION_REPORT.md`

---

## Nav structure (source of truth)

| Group | Routes |
|-------|--------|
| Home | Overview, Platform, Command Center |
| Operations | Users, Communities, Content, DM Safety, Voice |
| Care & Safety | Support, Support Team, Trust & Safety, Moderation Team, Security, Security Team |
| Growth | Advertising, Advertising Team, Ad Creative Review, Revenue, Finance Approval |
| Media | Radio, Podcast, Notifications, Analytics |
| System | System Health, Incidents, Roles & Permissions, Audit Logs, Feature Flags, Reports & Exports, Dashboard Settings |

## State model

Every module must support: **loading · empty · error · permission-denied · realtime-reconnect**.
