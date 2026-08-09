# Live Now / Publisher Alerting

## Alert rules

Canonical: `src/services/ops/liveNowAlertRules.ts`  
DB state machine: `live_now_ops_alert_states` (`OPEN` / `ACKNOWLEDGED` / `RESOLVED`) with dedupe key, first/last seen, occurrence count.

## Severity map

| Severity | Examples |
|----------|----------|
| SEV1 | Live Now + Go Live globally unavailable; security compromise; unauthorized finance access |
| SEV2 | LiveKit degraded; worker backlog; Ingress global failure; critical RPC spike; webhook signature flood; recording flag while blocked |
| SEV3 | Isolated worker failure; notification delay; single module degradation |
| SEV4 | Capacity trend / informational |

## Transport

```
ALERT_TRANSPORT: NOT_CONFIGURED
```

Rules/conditions can be **GO** while transport remains unconfigured. Do not invent Slack/email destinations. Do not send test spam to real recipients.

## Deduplication & recovery

- Upsert on `dedupe_key` increments `occurrence_count`
- Recovery signal sets `RESOLVED`
- Ack via `ack_live_now_ops_alert`
