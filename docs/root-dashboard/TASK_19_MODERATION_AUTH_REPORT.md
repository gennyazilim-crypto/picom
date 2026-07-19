# Task 19 — Moderation Auth Report

## 1. Summary of what was implemented

Moderation/T&S authorization matrix covers global vs community scope, content-only vs account actions, sanction limits, appeal separation, protected-category restrictions, and evidence-only DM access. Moderation Team page lists relevant role assignments. Root manages role grants.

## 2. Files changed

- `docs/root-dashboard/MODERATION_PERMISSION_MATRIX.md`
- `docs/root-dashboard/TASK_19_MODERATION_AUTH_REPORT.md`
- `src/components/rootDashboard/modules/ModerationTeamPage.tsx`
- Role catalog in `20260715140000_…`

## 3. Migrations / RLS

Assignments + list RPC `moderation_team`. Sanction mutation enforcement + MFA in `20260715141000_…`.

## 4. APIs / realtime

Team list branch; sanction RPCs follow-on.

## 5. Verification

Assign moderator → roster. Typecheck + smoke.

## 6. Security / privacy

Appeal separation and protected data restrictions are policy gates requiring server checks on mutate.

## 7. Remaining blockers

Hosted migrate + MFA for permanent sanctions.

## 8. Next task

**Task 20 — Advertising Campaign System** → `TASK_20_ADVERTISING_SYSTEM_REPORT.md`
