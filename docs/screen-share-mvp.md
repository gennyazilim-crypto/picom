# Screen Share MVP

Picom screen sharing is an Electron-only desktop feature that uses a safe preload bridge for source selection and LiveKit for publishing the selected screen/window track.

## Architecture

- Electron main process calls `desktopCapturer.getSources`.
- Preload exposes only `window.picomDesktop.screenCapture.getSources`.
- Renderer code uses `screenCaptureService` / `screenShareService`.
- React components never import Electron directly.
- `voiceService.startScreenShare(sourceId)` captures the selected source and publishes a LiveKit screen-share track.
- `voiceService.stopScreenShare()` unpublishes and stops the local track.
- Remote screen-share tracks are rendered by `ScreenSharePreview`.

## Security boundaries

- `contextIsolation` remains enabled.
- `nodeIntegration` remains disabled.
- IPC channels are whitelisted through `IPC_CHANNELS`.
- The renderer receives sanitized source IDs, names, types, and data URLs only.
- The renderer does not receive raw Electron objects.
- LiveKit API key/secret stay server-side in the token Edge Function.

## UI states

- Available: user is connected and can choose a source.
- Selecting source: source list is loading through preload.
- Sharing: selected track is published.
- Stopping: track is unpublished and stopped.
- Permission denied: browser/Electron capture permission was denied.
- Source unavailable: desktop capture bridge is missing or returns no source.
- Error: LiveKit publish/unpublish failed.

## Platform QA

Windows:

- Verify screen and window sources appear.
- Verify thumbnails render.
- Verify start/stop share works after joining voice.

Linux:

- Verify behavior on X11.
- Verify Wayland limitations are documented for the target desktop environment.
- Confirm source picker errors remain clear when capture is unavailable.

macOS:

- Screen Recording permission may be required.
- If permission is denied, Picom should show a clear error and remain connected to voice.

## Manual test flow

1. Start Picom in Electron.
2. Join a LiveKit voice room.
3. Choose a screen/window source.
4. Start sharing.
5. Confirm local preview appears.
6. Open a second window/user and confirm remote preview appears.
7. Stop sharing.
8. Leave the voice room.

## Current limitations

- Source picker uses Electron thumbnails; advanced preview controls are not included.
- Device/environment-specific Linux capture behavior needs manual QA.
- Full remote screen-share layout polish can be improved after MVP validation.
