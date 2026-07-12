# Meeting performance, bundle, and bandwidth budgets

## Measurement model

Picom keeps the global renderer budget in `scripts/performance-budget-ci.mjs`. Task 573 adds a meeting-specific gate without changing those existing limits:

- `scripts/meeting-asset-budget.mjs` reads the Vite manifest after `npm run build`.
- It proves `MeetingWorkspace`, the LiveKit media service, and screen-share focus are absent from the renderer's synchronous startup graph.
- It recursively measures the static graph unique to the lazy `MeetingWorkspace` entry.
- Nested dynamic imports such as `MeetingScreenShareFocus` are reported separately instead of being mislabeled as initial meeting JS.
- Raw bytes are authoritative; gzip is informational. Source maps are not included.
- The machine-readable report is written to `dist/meeting-asset-report.json` and is never a release artifact by itself.

Canonical limits live in `config/meeting-performance-budgets.json`. They add controlled headroom over the Task 572 clean-build baseline while the global hard caps remain unchanged.

## Runtime budgets

| Signal | Budget | Evidence |
| --- | ---: | --- |
| Join-to-connected p95 | 5,000 ms | Hosted two-client run; not inferred locally |
| Local media-control feedback | 100 ms | Electron interaction trace |
| 12-person layout planner p95 | 8 ms | Deterministic Node execution of the real TypeScript planner |
| Grid camera subscriptions | 12 maximum per page | Deterministic 1/2/4/9/12/24 scenarios |
| Speaker view camera subscriptions | 8 maximum | One focus tile plus seven filmstrip tiles |
| Screen-share companion cameras | 6 maximum | Screen-share focus policy |
| Active remote screen shares | 1 maximum | LiveKit subscription policy |
| Screen-share capture ceiling | 1920x1080 at 30 FPS | Electron capture hard ceiling; presets are lower/equal |
| 60-minute heap growth | 32 MiB maximum | Native release-candidate profile |

CPU percentage varies by hardware, codec, GPU acceleration, and Electron runtime. Picom therefore records CPU against a named native test machine rather than claiming a universal local pass. A release candidate must show no sustained upward trend and no UI long task above 100 ms during steady-state layout changes.

## Deterministic scenarios

`scripts/meeting-runtime-budget-smoke.mjs` transpiles and executes the real `buildMeetingVideoGridPlan` implementation. It covers 1, 2, 4, 9, and 12 participants, 24-participant pagination, and a stage-viewer fixture where viewers receive no camera subscription. A 10,000-cycle session simulation verifies the retained video-subscription set never exceeds one 12-person page.

Screen share remains one selected provider publication, with at most six companion cameras. Speaker focus remains one focus tile and seven filmstrip tiles. Stage viewers subscribe only to stage-role cameras; hosted load testing must verify configured stage sizes before operators raise room limits.

## Cleanup and rerender policy

- Grid, speaker, stage, and screen-share views publish bounded subscription plans through `meetingService` and clear them on unmount where applicable.
- Voice teardown stops local tracks, removes transcription handlers and provider listeners, and awaits disconnect.
- Meeting leave cancels reconnect timers, drains bindings, and clears participant state.
- Realtime participant subscriptions clear debounce/retry timers, remove Supabase channels, and clear dedupe state.
- No memoization/refactor was added without a measured bottleneck. Current selectors and memoized subscription plans remain the baseline.

## Commands

```powershell
npm run build
node scripts/meeting-asset-budget.mjs
node scripts/meeting-runtime-budget-smoke.mjs
npm run performance:budget:ci
```

Hosted join latency, long-session browser heap, native CPU/GPU, and real provider bandwidth remain separate evidence. Missing infrastructure is `BLOCKED`, never reported as passed.
