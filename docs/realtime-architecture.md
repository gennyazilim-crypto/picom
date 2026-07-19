# Realtime architecture

## Channel ownership

| Domain | Topic family | Owner | Events |
| --- | --- | --- | --- |
| Community messages | `room:community:*:channel:*` | community message hook | message insert/update/delete |
| Community typing | `typing:community:*:channel:*` | typing hook | private broadcast |
| Community presence | `presence:community:*` | presence hook/service | presence sync/join/leave |
| DM active conversation | `dm:data:conversation:*:active` | direct realtime service | message, reaction, attachment, read state |
| DM list | `dm:list:*` | direct realtime service | conversation/participant changes |
| DM typing | `dm:conversation:*` | direct typing hook | private broadcast |
| Feed | `feed:*` | feed realtime service | source-table invalidation |
| Saved messages | `saved-messages:current-user:*` | saved message service | saved row changes |

## Ordering and deduplication

- Community events have event IDs, bounded dedupe and timestamp/delete ordering guards.
- DM events use message/client IDs plus event timestamps in a bounded dedupe map.
- Feed rich-card cache deduplicates by message ID; query pages use a ranking epoch and cursor.
- Optimistic sends must reconcile by `client_message_id`, never only by body or timestamp.

## Lifecycle rules

1. Register every callback before `.subscribe()`.
2. Keep one owner per feature subscription.
3. Ignore callbacks after generation/cancellation changes.
4. Remove the channel during cleanup.
5. Clear debounce timers and local dedupe state during cleanup.
6. Treat reconnect as invalidation/refetch, not proof that no events were missed.

## Known architecture gap

Channel names are centralized, but subscriptions do not yet use a shared ref-counted lease manager. Introducing one is a P2 change because StrictMode, async authorization and private broadcast cleanup all require contract coverage first.
