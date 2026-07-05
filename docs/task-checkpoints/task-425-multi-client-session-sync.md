# Task 425: Multi-Client Session Sync

## Scope

- Added a typed multi-client user/session sync event foundation.
- Added a local event dispatcher for safe development testing.
- Wired `user:session_revoked` into the protected session hook.
- Documented the future Supabase Realtime channel and backend requirements.

## Safety decisions

- No access tokens, refresh tokens, passwords, cookies, or authorization headers are logged.
- Revoked-session handling uses a friendly user message and clears local auth UI state.
- Non-session events are redacted placeholders until backend refetch logic is implemented.

## Validation

- `npm run auth:multi-client-sync:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

1. Start Picom in mock mode.
2. Trigger `multiClientSessionSyncService.emitLocalPlaceholder({ type: "user:session_revoked", userId: "mock-current-user", reason: "manual test" })` in developer tooling.
3. Confirm the session is cleared and the user sees the revoked-session message.
