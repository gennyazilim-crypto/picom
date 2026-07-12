# Task 522 Checkpoint: Standard Noise Shield Processing

## Status

- Off mode: **COMPLETE**
- Standard mode: **COMPLETE**
- Applied-settings verification: **COMPLETE**
- Plain voice + meeting microphone integration: **COMPLETE**
- Enhanced/Voice Focus: **CONDITIONAL / NOT ACTIVE**

## Implementation

- Added canonical audio-processing settings, capability, capture-plan, applied-result, and error types.
- Added safe runtime constraint/track-setting detection.
- Added an Off/Standard capture planner with independent echo cancellation and automatic gain.
- Consolidated the old Noise Shield service into a compatibility facade over `noiseCancellationService`.
- Routed real LiveKit microphone enable, device replacement, reconnect reapply, mute/unmute, and leave cleanup through the canonical service.
- Added plain voice-room activation and actual microphone track verification.
- Preserved strict screen-share/Radio/Podcast isolation.
- Normalized the mode identifier to `voice-focus`, retaining legacy preference migration.

## Validation commands

- `node scripts/noise-shield-standard-processing-smoke.mjs`
- `node scripts/noise-shield-meeting-integration-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Validation ran in a disposable detached worktree. The existing clean-checkout brand-logo blocker was isolated with the same deleted non-production fixture documented by Task 582; no logo or user-owned asset is part of this task.

No package, provider, raw-audio capture, or external connection was added.

Commit message: `feat add standard noise shield processing`
