# Task 545 checkpoint: Camera and microphone device preview services

## Delivered

- Added bounded, generation-guarded camera preview capture and deterministic cleanup.
- Added permission-gated camera labels, mirrored self-view, unplug detection, and system-default fallback.
- Preserved the existing non-recording microphone level meter and Noise Shield constraints.
- Added microphone test restart when the selected/default input changes.
- Added cancellable speaker-test lifecycle around an original generated tone.
- Kept active Radio/Podcast output isolated from PreJoin speaker selection.
- Added readable device notices/errors and a structural regression smoke.

## Safety

- No raw camera/microphone media is stored, uploaded, or logged.
- No screen capture, recording, provider secret, or token persistence was added.
- Camera, microphone-test, and speaker-test resources stop on close/switch/unmount/join.

## Evidence status

Validated in a clean detached worktree at the Task 544 baseline with only Task
545 files applied and a generated one-pixel build-only brand image:

- Task 545, PreJoin, voice-device, and audio-settings smokes: PASS
- `npm run typecheck`: PASS
- `npm run mock:smoke`: PASS
- `npm run build`: PASS
- `npm run qa:smoke`: PASS
- `npm run performance:budget:ci`: PASS
- Initial JS: 1646.9 KiB (hard cap 1650.0 KiB)
- Initial CSS: 233.2 KiB (hard cap 240.0 KiB)
- Largest JS/CSS chunks: 1396.0 / 233.2 KiB
- Total assets: 3279.8 KiB (hard cap 3500.0 KiB)

Real native permission, device unplug, and output routing checks remain BLOCKED
until Electron is run with representative hardware on Windows, Linux, and
macOS. No native evidence is fabricated.
