# Task 31 — Role Management Report

## 1. Summary of what was implemented

Roles & Permissions module lists `platform_role_assignments` joined to profiles for operators. Catalog labels come from `platform_role_catalog`. Grant/revoke UI is paired with server enforcement + MFA for sensitive grants (mutation migration). Root owner assignment remains bootstrap-audited.

## 2. Files changed

- `src/components/rootDashboard/modules/RolesPermissionsPage.tsx`
- Team pages for support/security/moderation/ads
- `docs/root-dashboard/TASK_31_ROLE_MANAGEMENT_REPORT.md`
- Matrices under `docs/root-dashboard/*_PERMISSION_MATRIX.md`

## 3. Migrations / RLS

Catalog + assignments from operations core; grant RPCs in `20260715141000_…`.

## 4. APIs / realtime

`role_assignments` list module; has_platform_role helper.

## 5. Verification

Owner sees own `root_owner` assignment after bootstrap. Typecheck + smoke.

## 6. Security / privacy

No self-service elevation. Expiry timestamps honored in `has_platform_role`.

## 7. Remaining blockers

Hosted migrate + MFA for grants.

## 8. Next task

**Task 32 — Feature Flags** → `TASK_32_FEATURE_FLAGS_REPORT.md`
