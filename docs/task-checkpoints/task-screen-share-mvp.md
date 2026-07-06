# Task Checkpoint: Screen Share MVP

## Status

Completed.

## What changed

- Added `src/services/desktop/screenShareService.ts`.
- Added named screen-share MVP components:
  - `ScreenSourcePicker`
  - `ScreenShareControls`
  - `ScreenSharePreview`
- Wired `VoiceRoomView` through the named controls/preview components.
- Documented Electron security boundaries, platform permissions, and manual QA.

## Existing implementation verified

- Electron main process uses `desktopCapturer.getSources`.
- Preload exposes a whitelisted `screenCapture.getSources` bridge.
- Renderer uses service abstractions rather than raw Electron APIs.
- `voiceService` starts/stops LiveKit screen-share tracks.

## Commands to run

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run livekit:smoke`
