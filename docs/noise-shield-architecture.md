# Noise Shield Architecture

## Purpose

Noise Shield is a microphone-only processing layer inside Picom's existing LiveKit voice lifecycle. It is not an audio player, recorder, room implementation, or screen-share processor.

## Architecture boundaries

```text
Settings / PreJoin / Voice controls
                |
                v
     noiseCancellationService
       |        |         |
       |        |         +-- requested/applied diagnostics
       |        +------------ enhancedNoiseFilterService (lazy, conditional)
       +--------------------- audioCapabilitiesService
                |
                v
      audioCaptureOptionsService
                |
                v
        voiceService / LiveKit Room
                |
                v
      LocalAudioTrack (Microphone only)
```

Existing `noiseShieldService` remains a compatibility facade while call sites migrate to the canonical voice services. `voiceRoomService` remains a re-export and must not gain separate room state.

## Canonical state

State is separated into four concepts:

1. **Preference**: requested mode plus independent echo cancellation, automatic gain, and optional input device.
2. **Capability**: runtime-supported constraints and optional processor/provider availability.
3. **Capture plan**: optional/ideal constraints selected before microphone creation.
4. **Applied result**: actual safe track settings, processor status, fallback reason, and lifecycle generation.

Requested mode never implies applied mode.

## Mode resolution

```text
off
  -> supported suppression false
  -> echo/gain remain independently configured

standard
  -> native suppression when supported
  -> basic microphone with partial/unavailable status otherwise

enhanced / voice-focus
  -> lazy official provider capability check
  -> attach once to LocalAudioTrack microphone publication
  -> active only after successful initialization and setProcessor
  -> standard fallback on unsupported/load/attach/runtime failure
```

## Lifecycle ownership

One lifecycle manager owns the current microphone track reference, processor reference, track generation, pending initialization, and cleanup callbacks.

It must enforce:

- one active local microphone track per participant;
- one processor per microphone track;
- detach/dispose before track replacement;
- reapply after input switch or reconnect;
- no repeated native permission prompt;
- bounded retry with system-default device fallback;
- cleanup on leave, navigation, safe mode, and app shutdown;
- stale async initialization cannot attach to a replacement track.

## Source guard

The processor adapter must reject any source other than local microphone speech. Screen share, system audio, Radio, Podcast, uploaded music, studio sources, remote tracks, and HTML audio elements stay outside this dependency graph.

## Optional Enhanced provider

The audited official browser path is LiveKit's `@livekit/krisp-noise-filter`, attached through `LocalAudioTrack.setProcessor()` and removed through `stopProcessor()`. The package is not installed in the audited build.

Until dependency/license/bundle/provider approval is complete:

- Enhanced and Voice Focus remain unsupported in the capability result;
- a user request resolves to Standard without disconnecting voice;
- UI explains the exact fallback;
- no remote module, model, or raw audio is loaded at startup.

If enabled later, the provider module must be imported dynamically only after explicit mode selection. Its model-specific readiness and BVC support must be verified rather than inferred.

## Privacy and diagnostics

Allowed diagnostic fields:

- requested/applied mode;
- supported/applied booleans;
- processor state and stable error code;
- initialization duration;
- redacted one-way device identifier;
- lifecycle generation and cleanup counters;
- bounded CPU/memory approximations.

Forbidden diagnostic fields:

- raw or encoded microphone audio;
- waveforms/sample buffers;
- full session/track/provider objects;
- tokens or provider secrets;
- unrestricted device labels;
- hidden recordings or uploads.

## Persistence

Mode, echo cancellation, automatic gain, and remember-for-device behavior are device-local preferences. Session-applied state is never persisted as proof that a future track supports the same capability.

## Failure contract

Stable failure categories include:

- `MEDIA_UNSUPPORTED`
- `MIC_PERMISSION_REQUIRED`
- `MIC_DEVICE_UNAVAILABLE`
- `STANDARD_PARTIAL`
- `PROCESSOR_PACKAGE_UNAVAILABLE`
- `PROCESSOR_UNSUPPORTED`
- `PROCESSOR_LOAD_FAILED`
- `PROCESSOR_ATTACH_FAILED`
- `PROCESSOR_REPLACED`
- `PROCESSOR_DISPOSED`

Enhanced failures resolve to Standard where possible. A Standard capture failure resolves to a basic microphone only when safe; otherwise the microphone stays off with a user-readable error.

## Release rule

Local code/contract readiness, hosted provider readiness, and native acoustic certification are separate decisions. Missing provider/native evidence is BLOCKED, never PASS.

