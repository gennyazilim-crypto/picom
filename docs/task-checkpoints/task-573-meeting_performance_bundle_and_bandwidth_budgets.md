# Task 573 checkpoint: Meeting performance, bundle, and bandwidth budgets

## Result

Added a canonical meeting performance budget, Vite-manifest meeting asset report, deterministic supported-participant runtime test, bounded subscription checks, screen-share ceilings, and long-session cleanup contract. Existing renderer limits were not raised or bypassed.

## Changed files

- `config/meeting-performance-budgets.json`
- `scripts/meeting-asset-budget.mjs`
- `scripts/meeting-runtime-budget-smoke.mjs`
- `scripts/meeting-adaptive-video-grid-smoke.mjs` (updated stale fallback location to the shared participant tile)
- `docs/meeting-performance-budgets.md`
- `docs/task-checkpoints/task-573-meeting_performance_bundle_and_bandwidth_budgets.md`

## Required validation

```powershell
npm run build
node scripts/meeting-asset-budget.mjs
node scripts/meeting-runtime-budget-smoke.mjs
node scripts/meeting-adaptive-media-quality-smoke.mjs
node scripts/meeting-adaptive-video-grid-smoke.mjs
node scripts/meeting-reconnect-cleanup-smoke.mjs
npm run performance:budget:ci
npm run typecheck
npm run mock:smoke
npm run qa:smoke
```

## Evidence classification

- Manifest asset graph and deterministic planner scenarios: locally verifiable.
- Hosted join latency, LiveKit bandwidth, and multi-client load: `BLOCKED` until protected staging evidence is run.
- Native 60-minute CPU/GPU/heap profile: `BLOCKED` until Windows, Linux, and macOS release-candidate sessions are recorded.

No app UI, Supabase schema, provider permission, native Electron bridge, or unrelated user-owned file is changed by this task.
