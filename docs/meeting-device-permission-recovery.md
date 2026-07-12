# Meeting Device and Permission Recovery

## Recovery contract

- Picom observes microphone and camera permission status when the runtime supports the Permissions API. Observation never opens a permission dialog.
- Native permission requests remain tied to explicit user actions such as enabling a microphone/camera or opening the screen-source picker.
- `devicechange` bursts are debounced and carry a revision so a physical change behind the `default` alias still reaches LiveKit.
- Removed or busy selected microphones fall back once to the system default. Removed cameras fall back to the default camera; if no camera remains, the meeting continues camera-off.
- A single recovery promise refreshes device lists and replaces existing LiveKit tracks. It does not publish duplicate tracks or run an infinite retry loop.
- Sleep/wake, focus/visibility resume, browser-online, hardware change, and observed permission change use the same recovery coordinator.
- User mute and camera preferences are retained separately from forced permission-off state. Noise Shield is reapplied through the canonical microphone replacement path.
- Meeting TopBar reports the latest device recovery notice; actual mute/camera state remains provider-derived.

## Platform guidance

- **Windows:** Settings > Privacy & security > Microphone/Camera; allow desktop apps and Picom. Screen sharing uses the explicit Picom source picker.
- **Linux:** verify desktop privacy permissions and PipeWire/PulseAudio devices. Wayland screen sharing may require a desktop portal.
- **macOS:** System Settings > Privacy & Security > Microphone, Camera, and Screen Recording. Restart Picom when macOS requests it.

## Evidence limits

Automated contracts cover listener cleanup, single-flight replacement, fallbacks, state propagation, and no-automatic-prompt behavior. Physical hot-plug, OS permission revocation, busy-device competition, suspend/resume, and screen-recording recovery remain **BLOCKED** until native Windows/Linux/macOS hardware sessions are run.
