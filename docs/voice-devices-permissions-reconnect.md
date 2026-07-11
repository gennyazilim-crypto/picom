# Voice Devices, Permissions, and Reconnect

## Device recovery

`voiceDeviceService` owns permission, enumeration, persisted preferences, and device-change handling. When an explicitly selected input or output disappears, Picom normalizes the selection to an available system device, publishes the new preference to the active LiveKit room, and shows a recoverable notice. Failed input application leaves the user safely muted.

No microphone test uses `MediaRecorder`; the local level meter exists only in memory and all temporary tracks are stopped.

## Platform permission guidance

- Windows: Settings > Privacy & security > Microphone; desktop-app and Picom access must be enabled.
- macOS: System Settings > Privacy & Security > Microphone; Picom may need to restart after approval.
- Linux: desktop application/privacy permissions and the selected PipeWire or PulseAudio input must be available.

Picom requests microphone permission only after a user action. Camera access is not part of the Full MVP voice flow.

## Resume and reconnect

`voiceSessionRecoveryService` connects the existing desktop resume monitor to voice. A resume/focus/online burst is debounced by `sleepWakeResumeService`; devices refresh first, then only a session with retained join context and a recoverable connection state may reconnect.

Reconnect uses one coalesced promise and bounded delays of 0, 750, and 2,000 milliseconds. Changing rooms or leaving increments a generation token so delayed stale work cannot rejoin a room. Each join stops tracks, removes listeners, and clears participants before creating the next room, preventing ghost participants and duplicate listeners. Desired mute/deafen state remains in the snapshot and is restored after connection.

## Diagnostics boundary

Support diagnostics include status, participant count, mute/deafen/screen-share booleans, categorical connection quality and session-duration bucket, plus reconnect/join/device error counts. They exclude room/community/channel/user identity, token material, device labels, raw audio, and message content. The central diagnostics redactor still processes the complete export.
