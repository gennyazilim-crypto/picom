# Task 327 - Session Management Hardening

## Status

Completed.

## Scope

- Added a safe renderer-side session management foundation.
- Added Settings > Account active session visibility.
- Added a safe placeholder for revoking other sessions.
- Added documentation and a smoke test.

## Changed files

- `src/services/sessionManagementService.ts`
- `src/components/SettingsModal.tsx`
- `src/styles.css`
- `scripts/session-management-smoke-test.mjs`
- `package.json`
- `docs/session-management-placeholder.md`
- `docs/task-checkpoints/task-327-session-management-hardening.md`

## Verification

- `npm run auth:sessions:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual test

1. Start Picom in Electron dev mode.
2. Open Settings > Account.
3. Confirm the Active Sessions card appears.
4. Click Refresh sessions.
5. Click Revoke other sessions placeholder.
6. Confirm no token, password, or authorization header is displayed.

## Notes

- Real multi-session revocation must be enforced through a trusted Supabase/server-side flow later.
- The renderer only handles safe display and recoverable expired/revoked-session states.