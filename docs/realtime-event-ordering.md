# Realtime event ordering

Picom uses Supabase Realtime for MVP message updates. Realtime events can arrive more than once or arrive out of order during reconnects, tab/window contention, and network recovery. The renderer keeps the desktop UI stable by applying a small ordering guard before mutating local message state.

## Current foundation

- Realtime channel names remain centralized in `src/services/supabase/realtimeService.ts`.
- Message INSERT, UPDATE, soft-delete UPDATE, and hard DELETE events pass through an ordering guard in `src/hooks/useSupabaseMessageRealtime.ts`.
- Every processed event receives metadata:
  - `eventId`
  - `type`
  - `communityId`
  - `channelId`
  - `messageId`
  - `serverTimestamp`
  - `sequence` when available
- Event IDs are remembered in a bounded cache to avoid duplicate processing.
- Latest per-message timestamps are remembered during the subscription lifetime.
- Soft-delete updates are treated as `message:delete` ordering events.
- Older non-delete updates are ignored after a delete event for the same message.

## Event metadata

Supabase row-change payloads do not currently provide Picom-specific event IDs. The client derives a deterministic event ID from the message event type, community, channel, message ID, timestamp, optional sequence, and optional `clientMessageId`.

When a future server-side event envelope exists, it should provide durable fields directly:

- `eventId`
- `serverTimestamp`
- `sequence`
- `communityId`
- `channelId`

## Delete safety

Deleted messages should not reappear because an older update arrives late. Picom protects this in two places:

1. The realtime ordering guard rejects older non-delete events after a delete event.
2. The local message state keeps an existing deleted message when an incoming non-delete upsert is older than the deletion timestamp.

## Sequence numbers

Task 398 adds per-channel message sequence numbers. Message rows can now carry a stable `sequence` field for display ordering and future compound pagination. Realtime event freshness still uses timestamps for update/delete ordering because a message keeps the same sequence across edits.

## Manual verification

1. Run Picom in Supabase mode with two desktop windows.
2. Send messages rapidly in one window and confirm the second window does not duplicate messages.
3. Edit a message and confirm both windows show the latest body.
4. Delete a message and confirm an older edit/insert echo does not restore it.
5. Restart or interrupt the realtime connection and confirm reconnect does not duplicate recent messages.

## Known limitations

- This is a renderer-side reliability foundation, not a replacement for backend/RLS authorization.
- Event ordering is scoped to the active subscription cache; durable cross-session replay ordering requires server-provided sequence metadata.
- Reaction ordering will use the same metadata shape when reaction realtime events become fully server-backed.
