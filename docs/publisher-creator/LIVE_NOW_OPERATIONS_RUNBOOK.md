# Live Now Operations Runbook

## Health model

Separate **LIVENESS** / **READINESS** / **DEPENDENCY**. Statuses:

`HEALTHY` | `DEGRADED` | `UNAVAILABLE` | `DISABLED` | `NOT_CONFIGURED` | `UNKNOWN` | `BLOCKED` | `NOT_READY`

HTTP 200 alone is not HEALTHY.

## Status aggregation (Root/admin)

1. RPC: `get_live_now_ops_status()`  
2. Edge: `live-now-ops-status` (adds LiveKit ListRooms probe)  
3. Local contracts: `liveNowOpsService.localStatusSummary()`

Public status page: **OUT OF SCOPE**.

## Workers

| Worker | Health |
|--------|--------|
| email-worker | `127.0.0.1:$EMAIL_HEALTH_PORT/health` + `email_worker_heartbeats` |
| event-reminder-worker | process liveness + claim success (idle OK) |
| publisher-media-worker | infrastructure pending; jobs fail-closed with coded errors |

## Queues

`get_live_now_queue_health()` — bounded pending/retry/failed + oldest pending age (7d window). No full-table scans.

## SMTP distinctions

| Layer | Meaning |
|-------|---------|
| SMTP CONNECTION | transport.verify / heartbeat smtp_status |
| PROVIDER ACCEPTANCE | message accepted by SMTP |
| MAILBOX DELIVERY | end-user inbox — historical **AUTH_INBOX BLOCKED_RATE_LIMIT** |

## Feature flags / kill switches

Production child flags remain OFF. Emergency kill switches (client-config + `emergencyKillSwitchService`):

- `disableLiveNowDiscovery`
- `disableGoLive` (new attempts only)
- `disablePublisherExternalIngest`
- `disableLiveChat`
- `disablePublisherAnalytics`
- `disableLiveRecording`
- `disableCreatorStudio`
- `disablePublisherMonetization`

Impossible configs detected by `evaluate_live_now_feature_config_consistency` / `liveNowFeatureConfigGuard`.

## Canary separation

Report separately: SIGNALING | MEDIA | OBS | CHAT TWO-CLIENT | ANALYTICS MULTI-VIEWER | RECORDING.  
One signaling canary must not certify all.

## Client fail-safe

Module-specific degraded strings via `liveNowOpsCatalog` (10 locales). Desktop startup error boundary must not become the only Live Now failure mode.
