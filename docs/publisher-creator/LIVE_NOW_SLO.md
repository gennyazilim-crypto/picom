# Live Now / Publisher SLO & SLI

## Status

| Item | Value |
|------|-------|
| SLO_DEFINITION | **GO** |
| SLO_HISTORICAL_ATTAINMENT | **INSUFFICIENT_OBSERVATION_WINDOW** |
| ERROR_BUDGET | **NOT_YET_MEASURABLE** |

Do **not** invent 99.9% attainment. Targets are separate from measured history.

## Definitions

Canonical code: `src/services/ops/liveNowSloDefinitions.ts`

### Enabled-only SLOs

Apply only while the corresponding production feature flag is ON:

- Live Now discovery availability (target 99.5%, p95 ≤ 800ms)
- Go Live control success (target 99.0%, p95 ≤ 1500ms)
- Live chat mutation (target 99.0%, when chat enabled)

### Always-measurable when infra is live

- LiveKit signaling availability (signaling-only; media separate)
- Critical RPC success
- Worker processing (empty queue idle ≠ failure)
- Notification processing (SMTP accept ≠ mailbox delivery)

## SLI denominators

Exclude expected denials: unauthenticated, feature-flag OFF, suspended publisher, rate-limited abuse, banned users.

## Latency percentiles

Report p50/p95/p99 only when `sample_count` meets thresholds in `percentileRequiresSamples`. Never treat a single request as SLO evidence.
