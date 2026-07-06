# Backend Deployment Notes

Picom's MVP backend is Supabase-first: Auth, Postgres with RLS, Storage, Realtime, and Edge Functions. This document captures production deployment assumptions for backend-facing operations without introducing a separate Node server.

## Health endpoints

The public `health` Edge Function is unauthenticated and non-sensitive. It supports three monitoring endpoints:

| Endpoint | Purpose | Expected success | Failure behavior |
| --- | --- | --- | --- |
| `GET /functions/v1/health/live` | Liveness check | Edge Function process is running | Should fail only if the function cannot execute |
| `GET /functions/v1/health/ready` | Readiness check | Required dependencies are available | Returns `503` when a required dependency is unavailable or degraded |
| `GET /functions/v1/health` | Combined summary | Backward-compatible summary for desktop status checks | Returns summary with `ready.status` and dependency details |

The existing desktop services that call `/functions/v1/health` remain compatible because the combined summary still returns:

- `ok`
- `status`
- `message`
- `startedAt`
- `estimatedEndAt`
- `service`
- `function`
- `timestamp`

## Dependency status placeholders

Current readiness dependencies are represented through public, non-secret environment placeholders:

- `PICOM_HEALTH_DATABASE_STATUS`
- `PICOM_HEALTH_REDIS_STATUS`
- `PICOM_HEALTH_STORAGE_STATUS`
- `PICOM_HEALTH_REALTIME_STATUS`

Allowed values:

- `ok`
- `ok_placeholder`
- `degraded`
- `unavailable`
- `not_required`

Only `database` is marked required by default. Redis is optional for the Supabase MVP and becomes required only if a future horizontally scaled realtime backend depends on it.

## Production hardening TODO

Before production orchestration depends on readiness:

- Replace database placeholder with a real low-cost Postgres probe.
- Replace storage placeholder with a real Supabase Storage or object-storage probe.
- Replace realtime placeholder with a lightweight realtime gateway initialization check if self-hosted realtime is introduced.
- Decide whether Redis is required for the active deployment mode.
- Keep responses non-sensitive and never include credentials, connection strings, tokens, or private admin config.

## Local test commands

When the Supabase CLI is available:

```powershell
supabase functions serve health --no-verify-jwt
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/health
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/health/live
Invoke-RestMethod http://127.0.0.1:54321/functions/v1/health/ready
```

Readiness failure simulation:

```powershell
$env:PICOM_HEALTH_DATABASE_STATUS = "unavailable"
supabase functions serve health --no-verify-jwt
Invoke-WebRequest http://127.0.0.1:54321/functions/v1/health/ready
```

The final request should return HTTP `503` with a safe `not_ready` body.

## Monitoring guidance

- Use `/health/live` for process liveness.
- Use `/health/ready` for readiness and deployment orchestration.
- Use `/health` for dashboards and desktop client backend status summaries.
- Alert on repeated readiness failure before promoting a release ring.
- Do not expose secrets in health responses or logs.

