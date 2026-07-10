# Screen share quality presets

Picom exposes three bounded screen-share capture presets in the existing desktop source picker. `balanced` is the default, so existing callers and sessions keep their prior behavior.

| Preset | Capture ceiling | Frame-rate ceiling | Intended use |
| --- | --- | --- | --- |
| Presentation | 1920 x 1080 | 15 fps | Text, slides, documents |
| Balanced | 1280 x 720 | 24 fps | General sharing and moderate motion |
| Performance | 960 x 540 | 15 fps | Lower CPU and network pressure |

## Runtime behavior

- The selected preset is passed through the existing React-to-service boundary; components never call Electron or LiveKit directly.
- The renderer requests the existing Electron-approved source first, then applies bounded video-track constraints.
- Constraint application is best effort. A platform or capture source that rejects a preferred ceiling continues with the capture settings already granted by Electron, rather than failing the share.
- The setting applies only when a new share starts. It is disabled while sharing to avoid renegotiation surprises.
- No platform-specific capture hack is used.

## Privacy and security

- Presets do not record audio, frames, source names, room names, participant identifiers, IP addresses, or device identifiers.
- The source allowlist and safe preload bridge remain authoritative.
- LiveKit and Electron secrets never enter renderer state.

## Future validation

Before changing resolution ceilings or adding bitrate controls, run two-client Windows, Linux, and macOS checks for CPU use, text readability, motion, reconnection, and stop/start cleanup. Raw WebRTC telemetry remains out of scope until a separate privacy review.

## Checks

- `npm run screen-share:quality:test`
- `npm run livekit:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
