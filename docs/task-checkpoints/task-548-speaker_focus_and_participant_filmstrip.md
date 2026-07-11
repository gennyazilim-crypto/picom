# Task 548 checkpoint: Speaker Focus and Participant Filmstrip

## Delivered

- Added stable automatic speaker focus with debounce and silence hold.
- Added manual pin/unpin that overrides automatic focus and survives routine updates.
- Added a large camera/avatar focus stage with accessible controls.
- Added a seven-person paginated filmstrip with overflow count.
- Added speaking, mute, hand, role, quality, and verified identity states.
- Reused the adaptive video subscription boundary for focus and visible filmstrip media.
- Routed participant focus actions into speaker layout without changing screen-share mode.

## Safety

- No provider call is made directly by the UI.
- No media track is stopped, stored, uploaded, recorded, or logged.
- Timers are bounded and cleared on state change/unmount.

## Evidence status

Validated in a clean detached worktree at the Task 547 baseline with only Task
548 files applied and a generated one-pixel build-only brand image:

- Speaker-focus and adaptive-grid smokes: PASS
- `npm run typecheck`: PASS
- `npm run mock:smoke`: PASS
- `npm run build`: PASS
- `npm run qa:smoke`: PASS
- `npm run performance:budget:ci`: PASS
- Initial CSS: 233.2 KiB (hard cap 240.0 KiB)
- Largest JS/CSS chunks: 1398.5 / 233.2 KiB
- Total assets: 3282.2 KiB (hard cap 3500.0 KiB)

Hosted multi-speaker and large-room behavior remains BLOCKED until protected
LiveKit staging is available. No hosted result is claimed.
