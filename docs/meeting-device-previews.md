# Meeting device previews

Picom requests camera or microphone capture only after an explicit PreJoin
action. Camera capture is bounded to 1280x720 at no more than 30 frames per
second, mirrored only in the local self-view, and every track is stopped on
switch, close, successful join, or component deactivation.

The microphone meter reads time-domain levels through Web Audio. It does not
record, upload, persist, or log audio. The speaker test creates a short original
440 Hz oscillator tone and closes its private audio context after the test.

Device-change listeners fall back to an available system device and surface a
user-readable notice. PreJoin speaker selection suppresses the global consumer
notification so active Radio or Podcast playback keeps its current output.
Only safe device identifiers and join preferences are persisted locally.

## Native validation

Real permission dialogs, unplug/replug behavior, selected output routing, and
busy-device recovery require Windows, Linux, and macOS Electron smoke runs.
No native result is claimed by the structural/local validation.
