# Task 401 - Audit log immutability plan

## Summary

Created the audit log immutability plan for future moderation, app-admin, ownership, and compliance workflows.

## Changes

- Added `docs/audit-log-immutability.md`.
- Documented append-only policy, RLS expectations, sensitive data exclusions, retention separation, export placeholder, and production checklist.
- Added a smoke test that verifies the plan and centralized logging redaction references.

## Verification

Commands to run:

```powershell
npm run audit-logs:immutability:smoke
npm run typecheck
npm run build
```

Manual verification:

1. Read `docs/audit-log-immutability.md`.
2. Confirm audit logs are documented as append-only.
3. Confirm passwords, tokens, cookies, authorization headers, and private secrets are excluded from audit metadata.
4. Confirm the runtime still uses `loggingService` for redacted diagnostics.

## Known limitations

- The production `audit_logs` table and RLS policies are not implemented in this task.
- Placeholder admin/moderation flows must not claim immutable audit coverage yet.
