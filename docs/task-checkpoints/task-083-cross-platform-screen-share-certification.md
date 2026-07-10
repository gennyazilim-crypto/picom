# Task 083 Checkpoint: Cross-Platform Screen Share Certification

## Outcome

Prepared a release-oriented screen-share certification plan for Windows, Linux, and macOS without changing runtime behavior.

## Added

- Common source-picker, capture, remote playback, stop, denial, reconnect, and repeat-cycle test matrix.
- Windows multi-monitor and mixed-DPI coverage notes.
- Linux X11, Wayland, PipeWire, and desktop portal coverage notes.
- macOS Screen Recording permission and restart guidance.
- Redacted evidence template and explicit release pass criteria.
- Clear distinction between a prepared certification workflow and completed physical-platform certification.

## Safety

- No Electron, renderer, LiveKit, or UI behavior was changed.
- No production credentials or platform secrets were added.
- The plan requires staging accounts and redacted diagnostics.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`

Physical Windows, Linux, and macOS certification remains a release-candidate activity and is intentionally not claimed by this checkpoint.
