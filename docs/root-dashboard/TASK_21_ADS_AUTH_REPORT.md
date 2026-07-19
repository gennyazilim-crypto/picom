# Task 21 — Ads Auth Report

## 1. Summary of what was implemented

Advertising team authorization matrix separates creation, approval, and billing. Advertising Team page lists `ads_manager` / `ads_operator` assignments. Dual-control budget thresholds and reviewer role documented for mutation pack. No private user data via ads roles.

## 2. Files changed

- `docs/root-dashboard/ADS_PERMISSION_MATRIX.md`
- `docs/root-dashboard/TASK_21_ADS_AUTH_REPORT.md`
- `src/components/rootDashboard/modules/AdvertisingTeamPage.tsx`
- `20260715140000_…` advertising_team list branch

## 3. Migrations / RLS

Role assignments + RPC list. Threshold dual-control in `20260715141000_…`.

## 4. APIs / realtime

Team roster list; campaign mutate RPCs follow-on.

## 5. Verification

Assign ads_operator → roster. Typecheck + smoke.

## 6. Security / privacy

Finance viewer is read-only on spend; not a creative approver by default.

## 7. Remaining blockers

Hosted migrate + MFA for high budget changes.

## 8. Next task

**Task 22 — Ad Review and Brand Safety** → `TASK_22_AD_REVIEW_REPORT.md`
