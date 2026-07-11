# Voice, Audio, and Device Settings

Picom exposes media-device controls only from `Settings > Voice & Video`. Opening the app or settings never requests microphone, camera, or screen-capture permission.

## Permission and persistence

- The explicit **Allow microphone and load devices** action requests audio capture permission and immediately stops its temporary track.
- Device enumeration occurs after permission. Device-change events refresh the list, normalize removed selections, stop an active test, and fall back safely.
- Picom stores selected input/output device IDs plus capture preferences. It never stores labels, audio samples, streams, tokens, or other capture data.
- Camera capture is outside the Full MVP and is never requested by this flow.

## Microphone and output tests

- The microphone test creates a temporary local stream and Web Audio analyser. Only a normalized live level is exposed to React; closing/stopping the test stops every track and closes the audio context.
- Echo cancellation, noise suppression, and automatic gain controls are shown only when the browser reports each constraint as supported.
- The output test plays a short local 440 Hz tone. A selected speaker uses `AudioContext.setSinkId` where supported; otherwise Picom explains the limitation and retains the system-default route.

## Runtime application

- LiveKit joins publish the microphone with the selected device and supported capture options.
- Changing input, output, or processing preferences while connected applies them to the active room. Failure is non-fatal and appears as a safe voice-device error.
- Radio and Podcast playback applies the same selected output through `HTMLAudioElement.setSinkId` when supported, then falls back to the operating-system default without stopping playback.
- Radio/Podcast volume remains the existing persisted `audioPlayerService` default and can be adjusted from Voice & Video settings.

## Screen share

Screen capture remains an explicit action inside an active voice room. Settings provides platform guidance only and cannot start capture. macOS may require Screen Recording permission; Windows and Linux use the validated Electron source picker.
