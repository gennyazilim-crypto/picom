# Live Chat Architecture

Stream-scoped live chat for `publisher_streams` (TASK 28).

## Domain

Dedicated tables (not community `messages`):

- `live_chat_settings` — per-stream controls
- `live_chat_messages` — soft-deleted moderation states
- `live_chat_reactions` — bounded reaction keys
- `live_chat_moderators` — assignable stream mods
- `live_chat_timeouts` / `live_chat_bans`
- `live_chat_reports` / `live_chat_audit_events`
- `live_chat_rate_limits` — DB burst/sustained windows

## Send path

`send_live_chat_message` (SECURITY DEFINER):

1. `auth.uid()` sender (never client-supplied)
2. Active account gate (`publisher_profile_is_active_account`)
3. Stream status send-eligible (`connecting|live|reconnecting`)
4. Chat enabled / not emergency locked
5. Ban / timeout / followers-only / verified-only
6. Length, control chars, URL rules, spam fingerprint
7. Burst 5/10s + sustained 30/60s + slow mode
8. Idempotency key unique per stream+sender

## Realtime

Postgres Changes on `live_chat_messages` / `live_chat_settings` via `supabase_realtime`, RLS-gated.

## Client

- Flags: `enableLiveChat`, `enableLiveModeration` (production default OFF)
- `liveChatService` + `LiveStreamChatPanel` + `LiveChatModeratorConsole`
- Text-only rendering (no `dangerouslySetInnerHTML`)

## Retention

Indefinite / pending policy. No automatic purge worker.
