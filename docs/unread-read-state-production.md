# Unread and read-state production integration

Picom stores each authenticated user's last read message per channel in `public.read_states`. The renderer uses `readStateService`; UI components never query Supabase directly.

## Behavior

- Opening a channel resets its local unread dot and mention badge and calls `mark_channel_read`.
- While the active message list is within 96 px of the bottom, incoming messages remain read and the marker advances.
- If the user scrolls up, incoming messages set unread state. Mentions increment independently and do not get cleared by a later non-mention.
- Community-wide INSERT events cover visible inactive channels. Supabase RLS remains the authority for which channel events can reach the client.
- `get_my_community_unread_state` returns counts only for channels allowed by `can_view_channel` and never returns message content.

## Security

Read-state rows are self-owned and channel-visible under RLS. The write RPC validates both channel visibility and that the selected message belongs to that channel. The summary RPC returns identifiers and counts only. Logs contain error codes, not message bodies or credentials.

## Manual two-window check

1. Sign in as the same user in two desktop windows.
2. Keep window A in channel one and window B in channel two.
3. Send a normal message in channel two; window A shows an unread dot for channel two.
4. Send a mention in channel two; its mention badge increases separately.
5. Open channel two in window A; both indicators clear and the read marker persists.
6. Scroll window A above the 96 px bottom threshold, send again, and confirm unread appears without forcing scroll.
7. Return to the bottom and confirm the marker advances and reconnect does not duplicate counts.

This repository's static smoke validates the contract. The hosted two-window and RLS check still requires a migrated Supabase environment.
