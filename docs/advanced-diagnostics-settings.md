# Advanced Diagnostics, Logs, Cache, and Data Settings

Picom's Advanced and Diagnostics sections provide bounded desktop troubleshooting without exposing credentials or private chat content.

## Diagnostics snapshot

The support snapshot includes app version, release channel, build date, short commit, platform/runtime, data-source mode, safe Supabase host/status, Realtime status, LiveKit configuration, current voice status, current view, and redacted recent errors/logs. Community and channel identifiers are removed from exports.

Diagnostics pass through two layers:

1. credential redaction removes passwords, tokens, cookies, authorization values, JWTs, provider secrets, private keys, and signing material;
2. diagnostics-only content redaction removes structured `body`, `content`, `preview`, message-text, attachment URL, and signed URL fields.

Exports never include auth/session storage, raw environment values, message bodies, or attachment bytes.

## Logs and support

- Users can copy one selected log, copy the current filtered redacted list, or export the bounded log list.
- Clearing logs requires confirmation.
- Issue reports are prepared locally and redacted before copy/export.
- **Open support** uses the remote-config public support URL when configured and otherwise opens the repository issue intake page through the validated external-link service.

## Cache and reset scope

- Image cache clearing removes in-memory image metadata only; Chromium-managed bytes may remain until browser eviction.
- No separate message cache is persisted, so Picom never claims to delete one. Messages, drafts, queued sends, auth sessions, and server data remain untouched.
- Clear-all removes only image metadata and bounded redacted logs, after confirmation.
- Reset layout clears only Mention Feed selection/story state and per-community route memory.
- Reset local settings resets the versioned UI settings document only; auth, drafts, messages, and server state are preserved.
- First-launch reset remains a development/support-only action and requires confirmation.

## Safe Mode and migration status

Advanced settings can restart Picom with the existing Safe Mode flag. Safe Mode pauses optional Realtime, voice, notifications, tray, update, remote-config, theme, and heavy-diagnostics services without deleting auth or server data.

The local-data card reports manifest schema, settings schema, last migration time/result, and bounded recovery-backup count. It never enumerates or reads Supabase auth/session storage.
