# Load test results: 2026-07-10

## Result summary

**Partial / local synthetic only. No network or production traffic.**

Command:

```text
node scripts/realtime-load-simulation.mjs --clients=50 --messages=20 --delayMs=0 --reconnectEvery=5 --communityId=synthetic-load-community --channelId=synthetic-load-channel
```

Environment: local Node in-memory simulation, no Supabase, Storage, Realtime socket, LiveKit, Auth provider or external endpoint.

## Measured simulation output

| Metric | Result |
| --- | ---: |
| Simulated clients | 50 |
| Messages per client | 20 |
| Message events | 1,000 |
| Typing events | 2,000 |
| Presence events | 100 |
| Reconnect events | 200 |
| Total recorded events | 3,650 |
| Duplicate event attempts prevented | 1,000 |
| Script exit | 0 |

The simulation exercised deterministic event generation and event-ID deduplication. It did **not** measure network latency, Supabase throughput, database IO, RLS performance, actual Realtime delivery, Electron UI responsiveness, upload bandwidth, Auth limits, search performance, Edge Function latency or LiveKit capacity.

## Scenario status

| Scenario | Status | Evidence/gap |
| --- | --- | --- |
| Message generation/order metadata | Local synthetic pass | No database/API/realtime echo |
| Realtime connect/join/typing/presence/reconnect/dedup | Local synthetic pass | No WebSocket/provider load |
| Upload | Not executed | No approved staging Storage/scanner target |
| Auth | Not executed | No protected synthetic staging account/environment |
| Search | Not executed | No approved seeded staging target |
| LiveKit token function | Not executed | No protected staging function/env secrets |

## Safety evidence

- Default mode reported `dry_run_in_memory`.
- IDs and message bodies were synthetic.
- No provider endpoint/credential/token was supplied.
- No production execution flag was enabled.
- No persistent data or cloud cleanup was required.

## Decision

The local simulator is healthy as a development preflight. It is not production/staging load evidence. Release scalability remains unproven until the staged scenarios in `load-testing-plan.md` are executed with monitoring, permission checks, abort thresholds and cleanup evidence.
