# Task 505 Checkpoint: Screen Share Publish, Remote Render, and Stop Full MVP

## Status

Implemented locally. Real two-client provider certification remains blocked by unavailable protected staging credentials/native hosts.

## Completed

- Added explicit screen-scope token upgrade before capture/publish.
- Preserved microphone capability only when separately authorized.
- Rejected conflicting local screen shares without fake success.
- Published the selected video track as LiveKit ScreenShare.
- Rendered remote subscribed tracks through bounded viewer state.
- Cleaned remote shares on unsubscribe, unpublish, track end, participant disconnect, and room disconnect.
- Cleaned local share on stop, source/permission end, leave, room switch, and disconnect.
- Kept local preview muted and source label sanitized.
- Reflected active sharing in Connected Voice and user-visible start/stop outcomes.
- Kept capture fully user initiated.

## Validation

```powershell
npm run screen-share:publish:full-mvp:smoke
npm run screen-share:bridge:full-mvp:smoke
npm run screen-share:preview:test
npm run screen-share:recovery:test
npm run screen-share:quality:test
npm run livekit:token:security:smoke
npm run livekit:smoke
npm run typecheck
npm run mock:smoke
npm run build
npm run qa:smoke
npm run performance:budget:ci
```

## Manual/native evidence still required

- Two authenticated staging clients in the same voice room.
- Share each supported screen/window source; verify remote video and local label/state.
- Stop, restart, close the source, revoke permission, leave, disconnect network, and end the room.
- Verify one local share maximum and no ghost remote cards.
- Repeat on packaged Windows, approved Linux X11/Wayland, and macOS with Screen Recording permission.
