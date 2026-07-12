# Noise Shield performance report

## Automated baseline

The Task 525 clean-worktree gate passed the renderer performance hard caps after the lifecycle integration. The most recent recorded baseline before this diagnostics-only lazy UI addition was:

| Metric | Result | Gate |
| --- | ---: | --- |
| Initial JavaScript | 1191.8 KiB raw | PASS, target 1200 KiB |
| Initial CSS | 235.1 KiB raw | WARN, below 240 KiB hard cap |
| Largest image | 507.2 KiB raw | PASS, below 768 KiB target |
| Total assets | 3426.8 KiB raw | WARN, below 3500 KiB hard cap |
| Official processor runtime chunk | approximately 0.2 KiB raw | Lazy, excluded from initial entry graph |

Task 526 must rerun `npm run build` and `npm run performance:budget:ci`; generated hash names are intentionally not treated as stable identifiers.

## Processor timing

`processorInitializationDurationMs` measures dynamic provider load plus processor creation/attachment. It is `null` until an optional provider initialization is attempted. Standard mode uses Chromium's native WebRTC constraints and therefore has no separate model-ready timer.

The current repository does not install/configure an official Enhanced/Voice Focus provider package, so sustained provider CPU and model-ready results are `BLOCKED: PROVIDER_UNAVAILABLE`. Standard remains the truthful fallback.

## Runtime measurement protocol

| Metric | Method | Pass guideline | Current evidence |
| --- | --- | --- | --- |
| Lazy initialization | Support diagnostics duration, 10 cold attempts | Record p50/p95; no false active state | Automated state/timing contract PASS; native provider BLOCKED |
| Sustained CPU | OS process monitor over a controlled 15-minute call | No sustained regression agreed by release owner | NOT RUN on native hardware |
| Memory growth | OS/Electron process memory before/after 30-minute controlled call | No monotonic growth after leave/GC observation | Lifecycle buffer/listener contract PASS; native soak NOT RUN |
| Mode/device dropout | Second consenting client, timed device/mode switches | No duplicate audio; record each dropout | Deterministic sequencing PASS; acoustic timing NOT RUN |
| Listener cleanup | Lifecycle harness and existing memory audit | One shutdown listener, bounded events, zero retained microphone | Task-specific contract PASS |
| AudioContext cleanup | Existing voice-device test resources and lifecycle checks | Tests/contexts stopped on close | Voice-device contracts PASS |

## Known external audit blocker

The repository-wide `memory:leak:extended:audit` currently stops on the pre-existing Direct Messages assertion `DM realtime cleanup is missing canceled = true`. That failure is outside Noise Shield and is not suppressed or relabeled. The dedicated Noise Shield lifecycle harness independently verifies bounded event retention, listener deduplication, track stop, processor disposal, reconnect sequencing, and cleanup.

## Privacy

Diagnostics expose only a coarse renderer-memory bucket and a truthful CPU approximation (`inactive`, browser-managed, or external measurement required). They do not sample or export audio, report waveform data, include full device IDs/labels, or inspect room/session objects.
