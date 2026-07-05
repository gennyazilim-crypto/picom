# LiveKit room naming strategy

Task 213 defines Picom's deterministic LiveKit room naming strategy.

## Format

```text
picom:{communityId}:{channelId}
```

Example placeholder:

```text
picom:COMMUNITY_UUID:CHANNEL_UUID
```

## Rules

- `communityId` must be the Supabase community UUID.
- `channelId` must be the Supabase voice channel UUID.
- The room name must not include display names, emails, message content, invite codes, or tokens.
- The renderer may compute this name for request consistency, but the Edge Function remains the source of truth.
- The Edge Function rejects any supplied `roomName` that does not match the requested community/channel.
- Voice and screen-share intents share the same room so screen sharing belongs to the active voice room.

## Implementation points

- Renderer helper: `src/services/voiceRoomNaming.ts`
- Edge helper: `supabase/functions/_shared/livekit-room.ts`
- Token boundary: `supabase/functions/livekit-token/index.ts`

## Why deterministic names

- Prevents accidental duplicate rooms for the same voice channel.
- Keeps reconnect behavior predictable.
- Keeps room names free of private user data.
- Makes local/staging QA easier because the room can be derived from channel context.

## Manual verification

- Request a token without `roomName`; response should include `picom:{communityId}:{channelId}`.
- Request a token with the matching `roomName`; response should succeed if the user can access the voice channel.
- Request a token with a mismatched `roomName`; response should fail with `VALIDATION_ERROR`.
