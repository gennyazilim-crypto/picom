# Task 20 — Advertising System Report

## 1. Summary of what was implemented

Advertising module lists `ad_campaigns` (name, objective, status, spend counters) via paginated RPC. Summary KPI uses impression/click/spend aggregates. Schema supports draft → review → active/paused/archived and review_status. Empty campaigns → empty table (no demo advertisers).

## 2. Files changed

- `supabase/migrations/20260715140000_root_dashboard_operations_core.sql` — `ad_campaigns`, list/summary
- `src/components/rootDashboard/modules/AdvertisingPage.tsx`
- `docs/root-dashboard/TASK_20_ADVERTISING_SYSTEM_REPORT.md`

## 3. Migrations / RLS

RLS on; table grants revoked; admin RPC access. Mutation/pacing workers in follow-on work.

## 4. APIs / realtime

`list_root_dashboard_module_v1('ad_campaigns')`; overview ad impression/click totals.

## 5. Verification

Insert campaign row → lists in Panel. Typecheck + smoke.

## 6. Security / privacy

Operators see advertiser_label + aggregates, not private user profiles. Audience estimates must respect privacy thresholds when added.

## 7. Remaining blockers

Hosted migrate. Pacing workers not a hard auth blocker; Stripe unrelated to ads inventory itself.

## 8. Next task

**Task 21 — Advertising Team Authorization** → `ADS_PERMISSION_MATRIX.md`, `TASK_21_ADS_AUTH_REPORT.md`
