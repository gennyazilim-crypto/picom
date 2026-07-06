# LiveKit Voice MVP

Picom voice rooms use LiveKit in the renderer and a Supabase Edge Function for token creation.

## Room identity

Voice room names are deterministic:

```text
community:{communityId}:voice:{channelId}
```

The participant identity is the authenticated Supabase user ID. The display name is sent as `participantName`.

## Renderer flow

- Clicking a voice channel keeps the community sidebar visible and opens `VoiceRoomView` in the main content area.
- `VoiceRoomView` renders connection status, controls, participants, and speaking state from `voiceService`.
- Join calls `voiceService.join()`.
- Leave calls `voiceService.leave()`.
- Mute/unmute calls `voiceService.setMuted()`.
- Deafen/undeafen unsubscribes/resubscribes remote audio publications when connected.
- Active speakers update participants through `RoomEvent.ActiveSpeakersChanged`.

## Token flow

- Renderer calls `liveKitService.fetchToken()`.
- `liveKitService` invokes the Supabase Edge Function `livekit-token`.
- The Edge Function verifies the authenticated Supabase user and validates that the requested channel is a voice channel visible through RLS.
- LiveKit API key and secret are read only inside the Edge Function.
- The renderer never receives LiveKit API secrets or Supabase service-role keys.

## Manual QA

1. Configure local Supabase and LiveKit.
2. Start the Electron app in Supabase mode.
3. Sign in as two seeded users in two windows.
4. Open the same voice channel.
5. Join from both windows.
6. Confirm participant rows update.
7. Speak and confirm the speaking indicator updates.
8. Mute/unmute one user.
9. Deafen/undeafen remote audio.
10. Leave the room and confirm the participant list updates.

## Known limitations

- Device selection is still a placeholder.
- Backend permission enforcement lives in the Edge Function/RLS and should be expanded as role permissions mature.
- Screen share is handled by the separate screen-share task and is not expanded by this voice task.
