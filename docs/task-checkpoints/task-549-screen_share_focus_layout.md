# Task 549 checkpoint: Screen Share Focus Layout

## Delivered

- Added automatic screen-share promotion with explicit layout override and safe restore.
- Added dominant shared-content stage with Fit, Fill, and Actual Size controls.
- Added sharer identity, safe source label, and compact participant context column.
- Added one-active-remote-share subscription enforcement.
- Added track-muted/unmuted, unpublish, disconnect, and subscription-failure cleanup.
- Added Grid/Speaker return controls and stale-share fallback.
- Routed all provider changes through Voice/Meeting service boundaries.
- Restored the existing lazy VoiceService boundary by routing synchronous admin/diagnostics reads through a lightweight registry.

## Safety

- No raw screen media is stored, uploaded, recorded, or logged.
- UI code does not import LiveKit or stop provider-owned tracks.
- Existing Electron capture bridge and permission boundaries are unchanged.

## Evidence status

Validated in a clean detached worktree at the Task 548 baseline with only Task
549 files applied and a generated one-pixel build-only brand image:

- Screen-share focus, recovery, publish, LiveKit, diagnostics, and admin smokes: PASS
- `npm run typecheck`: PASS
- `npm run mock:smoke`: PASS
- `npm run build`: PASS
- `npm run qa:smoke`: PASS
- `npm run performance:budget:ci`: PASS
- Initial JS: 1172.5 KiB (target 1200.0 KiB; before split 1650.5 KiB)
- Initial CSS: 233.2 KiB (hard cap 240.0 KiB)
- Largest JS/CSS chunks: 921.8 / 233.2 KiB
- Total assets: 3283.8 KiB (hard cap 3500.0 KiB)

Native multi-monitor/source behavior and hosted remote subscription-failure
evidence remain BLOCKED until representative runners/staging exist. No native
or hosted pass is claimed.
