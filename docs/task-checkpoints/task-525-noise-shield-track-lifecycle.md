# Task 525 checkpoint: Noise Shield track lifecycle

## Scope completed

- Added one authoritative, serialized microphone track lifecycle manager.
- Routed initial enable, mute/unmute, device switch, reconnect, processing-mode change, disconnect, leave, and shutdown through that boundary.
- Added safe selected-device fallback and permission transition diagnostics without triggering automatic permission prompts.
- Added duplicate track/processor prevention, generation-checked cleanup, bounded diagnostics, and shutdown-listener deduplication.
- Preserved strict microphone-only processing isolation for screen share, Radio, Podcast, media playback, and music sources.
- Added deterministic lifecycle and leak-prevention contract coverage.

## Safety notes

- No raw microphone audio is recorded, persisted, uploaded, or logged.
- Track and device identifiers are represented only by one-way local diagnostic keys.
- No Supabase, LiveKit credential, Electron security, titlebar, or product UI behavior changed.
- Enhanced and Voice Focus remain conditional and fall back to Standard when their official provider runtime is unavailable.

## Validation contract

The task is gated by its lifecycle smoke test, existing voice device/recovery/reconnect contracts, typecheck, mock smoke, production build, QA smoke, audio-player isolation, and the renderer performance budget. Hosted/native acoustic evidence remains a later Task 527 gate and is never inferred from source contracts.
