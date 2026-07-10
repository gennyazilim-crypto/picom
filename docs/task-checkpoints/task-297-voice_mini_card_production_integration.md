# Task 297 - Voice mini card production integration

## Result

- Removed the feed-only mock voice state.
- FeedCompanionRail now receives the shared `voiceService` snapshot already subscribed by App.
- The sticky voice mini card appears only for connected or reconnecting LiveKit rooms.
- Active room name, reconnect state, participant count, mute, deafen, and screen-share state come from the production voice snapshot.
- Mute, deafen, and leave controls invoke the same voice service used by VoiceRoomView.
- Friends, events, mention filtering, and other feed state remain independent.

## Validation

- `npm run voice:mini-card:test`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual voice test

1. Join a configured LiveKit room from a voice channel.
2. Open Mention Feed and confirm the sticky card shows the active room and participant count.
3. Toggle mute/deafen in the mini card and confirm VoiceRoomView reflects the same state.
4. Interrupt the network and confirm the card shows restoring connection while reconnecting.
5. Leave from the mini card and confirm the card disappears and the room disconnects.

This manual test requires configured Supabase/LiveKit credentials and is not claimed by the static smoke test.
