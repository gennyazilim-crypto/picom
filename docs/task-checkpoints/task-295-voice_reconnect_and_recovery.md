# Task 295 - Voice reconnect and recovery

## Result

- LiveKit reconnecting and disconnected states remain explicit in the voice snapshot and room UI.
- Automatic reconnect restores the local microphone mute state and reapplies deafen subscriptions.
- Manual reconnect reuses the last safe room intent and does not store or expose the issued token.
- Concurrent join attempts are deduplicated.
- Participant snapshots are deduplicated by LiveKit identity.
- Leave and room replacement stop local tracks, remove room listeners, clear screen-share/participant state, and prevent stale callbacks.
- Intentional leave clears recovery intent; normal disconnect keeps enough non-sensitive intent for manual recovery.

## Validation

- `npm run voice:recovery:test`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual two-client test

1. Open two Picom desktop clients with different test identities and join the same voice channel.
2. Confirm each identity appears once in both participant lists.
3. Mute and deafen one client, interrupt its network briefly, and confirm the UI shows Reconnecting then Connected.
4. Confirm mute/deafen state remains applied after recovery.
5. Force a disconnect and use Reconnect; confirm participants do not duplicate.
6. Leave the room and confirm local tracks stop, participants clear, and no automatic recovery occurs.

Live two-client verification requires configured LiveKit/Supabase credentials and is not claimed by the static smoke test.
