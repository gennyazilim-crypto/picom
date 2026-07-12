# Enhanced Noise Shield and Voice Focus

## Runtime decision

Picom's installed LiveKit client supports the official `LocalAudioTrack.setProcessor()` lifecycle, but the optional `@livekit/krisp-noise-filter` package and provider entitlement are not present in this build.

Therefore:

- Enhanced and Voice Focus are not advertised as available modes.
- A legacy/persisted/direct request lazy-loads only Picom's provider boundary.
- The provider boundary returns `PROCESSOR_PACKAGE_UNAVAILABLE`.
- The active call continues with verified Standard WebRTC suppression where available.
- No package, model, audio upload, or initial-bundle preload is introduced.

This is a functional fail-safe path, not a fake Enhanced implementation.

## Lazy processor architecture

`enhancedNoiseFilterService` owns:

- provider loading only after Enhanced/Voice Focus is requested;
- initialization timing and stable state transitions;
- one processor per local microphone track;
- generation guards against stale async attachment;
- `setProcessor()` and `stopProcessor()` lifecycle calls;
- provider enable/dispose calls;
- track replacement and room disposal cleanup;
- Standard fallback without room disconnect.

The default provider loader is a dynamic import of `officialLiveKitNoiseProcessorRuntime.ts`. Vite emits that runtime as a lazy chunk; it is not in the synchronous entry graph.

## Status model

- `idle`
- `loading`
- `ready`
- `active`
- `unsupported`
- `failed`
- `disposed`
- `fallback-standard`

Requested, processor, and applied modes remain distinct. Enhanced/Voice Focus is shown as active only after the official provider reports support, creates a processor, LiveKit accepts it, and the processor enables successfully.

## Voice Focus warning

Voice Focus is opt-in. It is designed to suppress nearby background voices and may suppress real intended speakers around a shared microphone. It must not be used for shared microphones, multi-speaker interviews, Radio, Podcast, music, or studio sources.

## Enabling a provider in a later release

Before enabling the official package:

1. Add a pinned compatible dependency and regenerate/review third-party notices.
2. Replace the fail-closed runtime loader with a dynamic import of the official package.
3. Use the package support function and explicit NC/BVC model capability.
4. Verify package/model licensing and LiveKit Cloud entitlement.
5. Keep models/runtime assets outside startup and pass renderer total-asset hard caps.
6. Run two-client native acoustic, CPU, memory, reconnect, device-switch, and cleanup certification.

No provider support is inferred from Electron, Chromium, AudioWorklet, WebAssembly, or LiveKit version alone.

