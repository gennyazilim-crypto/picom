# Live Now / Publisher Observability

Updated: TASK34  
Branch: `release/picom-canonical-production`  
Authoritative base: `2ce0b9be` (or safe descendant)

## Inventory

| Tooling | Status |
|---------|--------|
| Sentry / OTel / Prometheus / Grafana | **Not present** in repository |
| Desktop structured logger | `src/services/logging/loggingService.ts` + redaction |
| Ops contracts | `src/services/ops/*` |
| DB telemetry (bounded) | `live_now_ops_*` tables via `20260808430000_live_now_production_ops.sql` |
| Root status RPC | `get_live_now_ops_status()` |
| Root edge aggregator | `supabase/functions/live-now-ops-status` |
| Admin LiveKit probe | `supabase/functions/admin-health` |
| Public `/health` | Liveness only unless real probes configured — **placeholders ≠ HEALTHY** |

Do not purchase APM for Task34. Provider-neutral hooks are mandatory.

## Structured logs

Required fields: `timestamp`, `service`, `severity`, `event`, `correlation_id`, safe `resource_id`, `error_code`.

Severities: `DEBUG` | `INFO` | `WARN` | `ERROR` | `CRITICAL`  
(`CRITICAL` maps to logger `error` with `ops_critical: true`.)

Never log: JWT, Authorization, service_role, LiveKit secrets, stream keys, SMTP passwords, payment/KYC payloads, full chat bodies by default.

## Correlation

Opaque UUIDs via `createLiveNowCorrelationId(scope)`. Propagate through Go Live, stream management, moderation, analytics finalize, team security, ops probes.

## Metrics

Minute buckets in `live_now_ops_metric_buckets`. Aggregate dimensions only — no `user_id`, `message_id`, `stream_key`, email, or IP labels.

## Self-protection

`record_live_now_ops_metric` / security counter bumps fail soft. Observability must not take down Go Live, chat, auth, or streaming.

## Audit vs log vs metric

| Channel | Purpose |
|---------|---------|
| AUDIT | Security/business action history (immutable tables/RPCs) |
| LOG | Technical diagnostics (redacted, mutable retention) |
| METRIC | Aggregate operational measurement |

## Retention

Operational cleanup bound via `cleanup_live_now_ops_telemetry` (default 14d). Formal policy: **RETENTION_POLICY_PENDING**.
