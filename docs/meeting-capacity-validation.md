# Meeting Capacity Validation

## Release boundary

Task 576 approves a **non-production Full MVP validation ceiling** of 12 synthetic participants per room. It does not certify production capacity. Production approval remains blocked until the protected staging matrix has real measurements, a current provider quota review, and a cost-owner decision.

| Scenario | Validation ceiling | Subscription boundary |
| --- | ---: | --- |
| Camera grid | 12 participants | At most 12 visible camera subscriptions; additional participants require paging and a later capacity decision. |
| Voice only | 12 participants | At most 11 remote audio subscriptions per client. |
| Screen share | 12 participants | One active screen share plus at most six companion cameras per viewer. |
| Stage/audience | Four broadcasters plus eight viewers | Viewers publish no audio, camera, or screen tracks and subscribe to at most four stage videos. |

The room administration schema can store a higher configured participant count. That configuration is not evidence that the desktop client, provider account, network, or budget supports it. Release operators must keep production limits at or below the certified value.

## Evidence layers

`node scripts/meeting-multi-participant-capacity-test.mjs` executes the real video-grid planner and validates:

- 12-participant camera, voice-only, screen-share, and stage contracts;
- bounded and duplicate-free video subscriptions during 12,000 join/reconnect/layout cycles;
- retained heap growth after garbage collection against the 32 MiB budget;
- planner p95 responsiveness against the 8 ms budget;
- viewer publication restrictions and stage-only video selection;
- server-authoritative reaction, raise-hand, and meeting-chat rate-limit values.

This deterministic layer does not claim network, media-provider, native CPU, or WebRTC memory evidence. Bandwidth values emitted by the script are planning estimates only.

## Protected hosted run

Use only an isolated staging project and synthetic accounts. Never point the load harness at production.

1. Confirm the staging project is isolated from production data and billing alerts are enabled.
2. Review `tests/performance/meeting-hosted-capacity-matrix.json` before creating accounts or traffic.
3. Run each scenario long enough to cover steady state, churn, and reconnect.
4. Collect redacted measurements under `docs/evidence/task-576/`; never store raw microphone, camera, or screen media.
5. Populate a separate evidence JSON matching `docs/evidence/task-576-meeting-capacity.json`.
6. Set `PICOM_MEETING_LOAD_CONFIRM=STAGING_ONLY` only for the protected run.
7. Validate with:

   `node scripts/hosted-meeting-capacity-validation.mjs --run --evidence <redacted-evidence.json>`

The validator fails closed unless every scenario and rate-limit case passes, every evidence reference exists, viewers publish zero tracks in stage mode, resource budgets pass, and provider quota/cost reviews are approved.

## Required measurements

- Join latency p95 at or below 5 seconds.
- UI/control response p95 at or below 100 ms.
- Average client CPU at or below 70% and peak at or below 85% on the approved reference hardware.
- Retained heap growth at or below 32 MiB over the approved long-session window.
- Active subscriptions at or below each scenario boundary.
- Reconnect success rate at or above 99%.
- Measured inbound/outbound bandwidth for every scenario.
- Server rejection of the first request above each reaction, hand, and chat limit, including a retry-after response.

## Rate-limit contract

| Feature | Server action | Limit |
| --- | --- | ---: |
| Raise/lower hand and stage request | `meeting_signal_write` | 12 requests / 60 seconds |
| Meeting reaction | `meeting_reaction` | 8 requests / 3 seconds |
| Meeting chat link | `meeting_chat_send` | 20 requests / 30 seconds |

Frontend throttles improve UX but do not replace these database-enforced limits.

## Provider capacity and cost blockers

- The current LiveKit project quota and plan must be read from the provider dashboard immediately before certification.
- The review-time figures in `docs/livekit-capacity-plan.md` are planning context, not a current guarantee.
- No approved monthly participant-minute/downstream-data budget owner is recorded in Task 576 evidence.
- Multi-region Windows, Linux, and macOS reference hardware measurements are not available in this environment.
- Hosted Supabase rate-limit and LiveKit track/subscription runs require protected staging configuration that is not available locally.

Until these items pass, `hostedCertificationStatus` remains `BLOCKED`; the local contract may not be presented as production capacity evidence.
