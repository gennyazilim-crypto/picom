# Task 35 — Realtime Report

## 1. Summary of what was implemented

Realtime strategy for Panel: postgres_changes / channel subscriptions on operational tables (`support_tickets`, `platform_incidents`, `ad_campaigns`, audit inserts) scoped to admin sessions, plus reconnect UI states in `DashboardState`. Overview polling remains a fallback when subscription not available. Modules must show realtime-reconnect — never silent stale green.

## 2. Files changed

- `src/components/rootDashboard/components/DashboardState.tsx`
- `src/components/rootDashboard/RootDashboardApp.tsx` / module pages (refresh hooks)
- `src/services/rootDashboard/rootDashboardOperationsService.ts`
- `docs/root-dashboard/TASK_35_REALTIME_REPORT.md`

## 3. Migrations / RLS

Realtime authorized only if table replication + RLS allow; SECURITY DEFINER lists remain source of truth for row payloads.

## 4. APIs / realtime

Supabase Realtime channels for ops tables; client resubscribe on disconnect.

## 5. Verification

Toggle network → reconnect state. Insert ticket while Panel open → list refresh. Typecheck + smoke.

## 6. Security / privacy

No public channels for ops tables; JWT required.

## 7. Remaining blockers

Hosted Realtime publication configuration must include ops tables after migrate.

## 8. Next task

**Task 36 — Performance and Scalability** → `TASK_36_PERFORMANCE_REPORT.md`
