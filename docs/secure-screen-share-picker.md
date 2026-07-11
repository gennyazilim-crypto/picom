# Secure Electron Screen Share Picker

Picom exposes no raw Electron, Node, `ipcRenderer`, or `desktopCapturer` object to the renderer. The source picker uses three narrow, whitelisted operations:

1. `getSources` requires a validated unpredictable request ID, `userInitiated: true`, a trusted sender, and a focused Picom window.
2. Main returns at most 50 sanitized screen/window descriptors with bounded PNG data URLs and stores them in a 60-second session tied to the requesting WebContents.
3. `selectSource` accepts exactly one source ID from that session, returns only its id/name/type, and consumes the session. `cancelSelection` also consumes the session without starting capture.

Invalid, expired, replayed, cross-window, unknown-source, unfocused, and untrusted requests fail without invoking capture. The React picker loads sources only from its Choose source button, exposes Cancel, and validates the final selection before calling the LiveKit screen-share path.

Platform handling:

- macOS denied/restricted Screen Recording permission is reported before source enumeration.
- Linux provides portal/Wayland guidance when enumeration fails.
- Windows provides protected-window/display guidance.
- An unavailable Electron bridge never falls back to browser-wide or raw native access.

Native source names and thumbnails can contain visible desktop information, so they exist only after explicit action and are not logged, persisted, uploaded, or included in diagnostics.
