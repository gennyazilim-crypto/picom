# Task 544 checkpoint: Meeting PreJoin Full MVP

## Delivered

- Added room/community/host/join-policy and waiting-room information.
- Added explicit-action camera preview with camera selection and deterministic cleanup.
- Reused production microphone selection/test and speaker selection/test services.
- Added safe persisted join-muted, camera-off, camera device, and Noise Shield preferences.
- Added typed denied/missing/busy/unsupported/token recovery states.
- Connected submit to the canonical meeting token/waiting-room join flow.
- Propagated initial mute/camera choices through the LiveKit adapter and existing voice transport.
- Added scoped desktop UI, structural smoke, and operating documentation.

## Privacy and safety

- No camera or microphone capture starts at module load or workspace entry.
- No screen capture, recording, provider secret, token persistence, or raw media persistence is present.
- Preview and test tracks stop before joining or leaving PreJoin.

## Validation

Validated in a clean detached worktree at the Task 543 baseline with only the
Task 544 files applied. A generated one-pixel verification image replaced the
uncommitted local brand image for build measurement only.

- `node scripts/meeting-prejoin-full-mvp-smoke.mjs`: PASS
- `node scripts/meeting-client-state-machine-smoke.mjs`: PASS
- `node scripts/voice-device-selection-smoke.mjs`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run qa:smoke`: PASS
- `npm run performance:budget:ci`: PASS

The live checkout also contains concurrent, task-unrelated UI edits. Their
temporary `ServerRail`/`AppIcon` type errors and larger local brand asset were
excluded rather than changed or committed by this task.

## Remaining evidence

Real camera/microphone permission prompts, busy-device behavior, and token/waiting admission require native and hosted staging execution. These validations remain BLOCKED locally until protected provider credentials and platform runners are available.
