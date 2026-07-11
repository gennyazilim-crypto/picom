# Screen Share Publish and Render Lifecycle

## Explicit publish

Screen capture begins only after the user opens the Task 504 picker, selects an approved source, and presses Start sharing. A normal voice token can publish only microphone. At that explicit action Picom reconnects the same identity to the same deterministic LiveKit room with `intent: screen` before capture starts.

The screen token requires `shareScreen`. It includes microphone only when the authorization RPC independently returns `can_publish_audio`; screen permission never grants voice permission. Tokens remain short-lived and cannot publish data.

Only one local screen track may exist. A second request returns `VOICE_SCREEN_SHARE_CONFLICT` without changing the active share. The selected source ID is validated again before `getUserMedia`, then the video track is published with `Track.Source.ScreenShare`.

## Local lifecycle

The local preview uses the published track and a sanitized source label. Stop unpublishes the track, removes the preview, clears the active flag, detaches `onended`, and stops capture. An operating-system-ended track follows the same cleanup but leaves a recoverable explanation. Leave, room switch, reconnect failure, and room disconnect stop local media and clear all screen-share state.

## Remote lifecycle

`TrackSubscribed` creates one `MediaStream` for each remote screen-share publication. The viewer attaches it through `video.srcObject`. `TrackUnsubscribed`, `TrackUnpublished`, media-track `ended`, participant disconnect, and room disconnect all remove the corresponding card and detach event handlers, preventing stale/ghost shares.

## Evidence boundary

Structural tests prove publish/unpublish/event/UI wiring and scoped token behavior. A real remote client seeing the share requires deployed Supabase/LiveKit staging, two authenticated clients, and native screen-recording permission; this remains blocked without protected staging credentials and native platform runs.
