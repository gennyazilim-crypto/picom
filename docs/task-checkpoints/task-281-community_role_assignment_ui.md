# Task 281 checkpoint: community role assignment UI

## Completed

- Added reusable owner/admin role hierarchy checks.
- Added compact Members-section role selectors only for manageable targets.
- Added a service-only Supabase assignment path and safe mock fallback.
- Added backend hierarchy enforcement, target row locking, and redacted audit logging.
- Kept ownership changes in the existing transfer workflow.
- Updated app member state immediately after a successful assignment.

## Verification

- `npm run community:role-assignment:test`
- `npm run community:access:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining environment check

Apply the migration and test owner-to-admin/mod/member assignment, admin-to-lower assignment, equal/higher denial, owner denial, cross-community IDs, and concurrent updates against Supabase. No hosted/CLI pass is claimed here.
