# Task 547 checkpoint: Adaptive Video Participant Grid

## Delivered

- Added deterministic one-through-twelve camera layouts and 12-person pagination.
- Added actual local/remote camera stream transport through VoiceService and MeetingClient state.
- Added camera-off and subscription-pending avatar fallbacks without black boxes.
- Added focused, active-speaker, local self-view, and published-camera ordering.
- Added per-page remote subscription and HIGH/MEDIUM/LOW quality policy.
- Preserved LiveKit adaptive stream/dynacast and the meeting service abstraction.
- Added live per-participant connection quality mapping and cleanup.

## Safety

- Renderer grid code does not import or call LiveKit directly.
- Provider-owned media tracks are detached, not stopped, by UI lifecycle.
- No raw media storage, upload, logging, recording, or screen-capture change was added.

## Evidence status

Validated in a clean detached worktree at the Task 546 baseline with only Task
547 files applied and a generated one-pixel build-only brand image:

- Adaptive-grid, meeting-state, workspace, Voice, and LiveKit smokes: PASS
- `npm run typecheck`: PASS
- `npm run mock:smoke`: PASS
- `npm run build`: PASS
- `npm run qa:smoke`: PASS
- `npm run performance:budget:ci`: PASS
- Initial CSS: 233.2 KiB (hard cap 240.0 KiB)
- Largest JS/CSS chunks: 1398.5 / 233.2 KiB
- Total assets: 3282.2 KiB (hard cap 3500.0 KiB)

Hosted multi-client quality adaptation and bandwidth evidence remain BLOCKED
until protected LiveKit staging is available. No hosted result is fabricated.
