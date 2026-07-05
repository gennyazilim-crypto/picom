# Multi-Client Session Sync

Picom prepares desktop clients to respond safely when the same account is active in multiple app instances or devices.

## Current MVP foundation

- `multiClientSessionSyncService` defines the event contract.
- The protected desktop session hook listens for sync events.
- `user:session_revoked` signs out the current desktop session safely.
- Profile, settings, permissions, and membership sync events are logged as redacted placeholders.
- No passwords, tokens, cookies, authorization headers, or raw session values are logged.

## Event contract

- `user:profile_updated`
- `user:settings_updated`
- `user:session_revoked`
- `user:permissions_updated`
- `user:membership_updated`

## Future Supabase path

The future Supabase channel can use:

```text
user-sync:{userId}
```

Supabase/Edge Function requirements:

- Auth middleware must reject expired or revoked sessions.
- Realtime sockets for revoked sessions should disconnect.
- Event payloads must include safe ids only, never access tokens or refresh tokens.
- Permission and membership events should trigger refetches of visible communities/channels.
- Notification/profile setting events should refresh local cached settings without exposing secrets.

## User-facing behavior

If the current session is revoked, Picom shows:

```text
You were signed out because this desktop session was revoked.
```

The user can sign in again normally. Existing local UI should not crash or show raw provider errors.

## Manual QA

1. Start Picom in mock mode.
2. In developer tooling, call `multiClientSessionSyncService.emitLocalPlaceholder()` with `type: "user:session_revoked"`.
3. Confirm the app signs out and shows the friendly revoked-session message.
4. Confirm redacted logs do not include passwords, tokens, or authorization headers.
