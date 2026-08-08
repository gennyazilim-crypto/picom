# Live Chat Moderation

## Roles

| Role | Powers |
|------|--------|
| Stream owner | Settings, assign/remove mods, pin, timeout, ban, delete, emergency disable |
| Stream moderator | Delete, timeout, ban/unban, pin |
| Platform (`publisher.moderate_live` / root) | Cross-stream emergency + audit |
| Viewer | Send/read/react/report when eligible |
| `dashboard.read` | No chat moderation |

## Actions (RPC only)

- `remove_live_chat_message` → `deleted_by_moderator` (soft)
- `timeout_live_chat_user` — 60/300/600/1800/3600/86400 seconds
- `ban_live_chat_user` / `unban_live_chat_user`
- `pin_live_chat_message` / `unpin_live_chat_message` (one pin)
- `assign_stream_moderator` / `remove_stream_moderator` (owner/platform)
- `update_live_chat_settings`

## Ban vs timeout

- Timeout: temporary, auto-expires (`expires_at > now()`)
- Ban: stream-scoped until revoked; does not stop watching by itself
- Distinct from `platform_account_restrictions`

## Audit

Append-only `live_chat_audit_events`. No message body in metadata. Owner/platform select only.
