# Task 329 - Account deletion real implementation

Status: implemented with finalization disabled pending hosted/legal/operations approval.

- Exact username plus current-password re-authentication is required; passwords are never persisted or sent to deletion APIs.
- Backend requires a JWT issued within five minutes and rejects owned communities.
- Request records a 14-day grace period, globally revokes sessions and appends account security events.
- Finalizer rechecks all gates, anonymizes to `Deleted User`, preserves messages/audit evidence and soft-deletes Auth.
- Settings reloads the current user's backend request status.
- Hosted global-revoke, RLS, scheduler and finalization tests remain pending without Supabase staging/CLI.

Validation:
- `npm run privacy:account-deletion:real:test`
- `npm run auth:account-deletion:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
