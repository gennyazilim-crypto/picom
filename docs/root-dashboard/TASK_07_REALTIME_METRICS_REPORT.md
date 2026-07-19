# Task 07 — Realtime Metrics Report

## 1. Summary of what was implemented

Server-side aggregation for Panel overview and module KPI strips:

- Live-ish presence: online users / active sessions / voice rooms (from real presence/voice sources when available).
- Registrations 24h, support backlog, moderation backlog, security alerts 24h.
- Ad impressions/clicks from `ad_campaigns` sums.
- Active subscriptions + MRR cents from `subscription_records`.
- Open incidents + privileged actions 24h from audit.
- Analytics DAU/WAU/MAU only if warehouse available.

Client parser in `rootDashboardOperationsService` maps JSON to typed metrics with `source` and `checkedAt`; falls back to `local_empty` without inventing nonzero defaults for analytics series.

## 2. Files changed

- `supabase/migrations/20260715140000_root_dashboard_operations_core.sql` — `get_root_dashboard_overview_v1`, `get_root_dashboard_module_summary_v1`
- `src/services/rootDashboard/rootDashboardOperationsService.ts`
- `src/services/rootDashboard/rootDashboardOverviewService.ts`
- `src/types/rootDashboardOperations.ts`
- `src/components/rootDashboard/modules/OverviewPage.tsx`
- `docs/root-dashboard/TASK_07_REALTIME_METRICS_REPORT.md`

## 3. Migrations / RLS

Aggregations run inside `SECURITY DEFINER` RPCs gated by `is_app_admin()`. Direct table access remains revoked.

## 4. APIs / realtime

- Primary: `get_root_dashboard_overview_v1()`
- Module strips: `get_root_dashboard_module_summary_v1(module_name)`
- Polling / postgres_changes refresh strategy detailed in task 35.

## 5. Verification

- Empty ops tables → zeros / empty strips, not sample campaigns.
- Analytics off → null engagement series.
- Typecheck + smoke.

## 6. Security / privacy

- Admin-only execution.
- No raw event streams exposed to browser beyond aggregates.

## 7. Remaining blockers

- Hosted migration apply.
- Timezone-aware reporting refinements depend on product locale config (not a hard stop for empty-safe totals).

## 8. Next task

**Task 08 — Root Overview Dashboard** → `TASK_08_OVERVIEW_REPORT.md`
