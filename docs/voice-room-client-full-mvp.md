# Voice Room Client Full MVP

## Runtime ownership

`voiceService` is the single owner of the active LiveKit `Room`. React surfaces subscribe to its immutable snapshot and never create a second room or register LiveKit listeners directly.

The snapshot carries a stable `roomContext` with community and channel identifiers plus display labels. LiveKit's server room name remains an implementation detail. This keeps the Voice Room view, active-room discovery, and Mention Feed Connected Voice card synchronized even when the user navigates away from the channel.

## Connection lifecycle

- `joinInFlight` rejects duplicate concurrent joins.
- Joining another channel removes listeners, stops local tracks, and disconnects the previous room first.
- LiveKit connection state drives connecting, connected, reconnecting, and disconnected UI.
- Active speaker events update participant speaking indicators.
- Unexpected room closure clears participants and reports an actionable room-unavailable state.
- Explicit leave and Electron window shutdown stop local tracks, remove listeners, and disconnect.
- `lastJoinRequest` supports an intentional reconnect without duplicating listeners.

## Audio controls

- Mute publishes or stops the local microphone through LiveKit.
- Deafen unsubscribes/resubscribes remote audio without changing membership.
- `VoiceDevicePanel` uses `voiceDeviceService` for permission requests, enumeration, persisted input/output selection, and hot device changes.
- A denied microphone or missing input device leaves the room connected but muted and presents a recoverable explanation.

## Permission boundary

The renderer performs UX checks before requesting a token. The `livekit-token` Edge Function and `authorize_livekit_room` RPC remain authoritative for membership, ban, timeout, channel visibility, and voice/screen permissions. A client-side state change cannot grant room access.

## Provider validation

Local smoke tests verify wiring and lifecycle contracts. Real two-client audio, server-ended-room behavior, and network reconnect evidence require deployed Supabase and LiveKit staging credentials and must be captured through the protected hosted validation workflow.
