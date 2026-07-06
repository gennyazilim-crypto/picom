# Backend Graceful Degradation

Picom's MVP backend is Supabase-first. Graceful degradation means core desktop chat flows should remain usable when optional services fail, while critical dependency failures clearly block readiness and release promotion.

This policy is for Windows, Linux, and macOS desktop releases. It does not add mobile behavior or new post-MVP features.

## Critical vs optional services

| Service | Current status | Critical for startup | Degraded behavior |
| --- | --- | --- | --- |
| Supabase Auth | Required for Supabase mode | Yes | Block authenticated API-mode flows and show sign-in/session error |
| Supabase Postgres/RLS | Required for Supabase mode | Yes | `/health/ready` should fail and release rollout should pause |
| Supabase Storage | Required for image uploads | No for text chat | Disable uploads or show upload unavailable while text chat remains usable |
| Supabase Realtime | Required for live updates | No for API-only chat | Fall back to fetch/manual refresh patterns where available |
| LiveKit | Required for voice/screen share | No for text chat | Disable voice room joins and screen share controls |
| Redis | Optional for current Supabase MVP | No | Keep local/Supabase realtime path; require Redis only for future horizontal scaling |
| Email | Optional for current desktop MVP | No | Disable email-dependent flows and show clear placeholder |
| Analytics/crash reporting | Optional | No | Log local redacted diagnostics only |
| Auto-update | Out of scope for production MVP | No | Keep manual release/package flow |

## Health endpoint behavior

The `health` Edge Function exposes safe service state:

- `/functions/v1/health/live`: process liveness only
- `/functions/v1/health/ready`: fails only when required dependencies are unavailable or degraded
- `/functions/v1/health`: combined summary for dashboards and desktop status UI

Optional dependency failures should set the combined `/health` response to `status: "degraded"` while keeping `/health/ready` successful if required dependencies are healthy.

## Remote config/status exposure

Remote config and health responses may expose only non-sensitive state:

- service name
- dependency status
- maintenance/degraded message
- feature flag or kill switch availability
- public support/status URLs

They must not expose:

- database URLs
- Supabase service-role keys
- LiveKit secrets
- object storage credentials
- auth tokens
- private admin configuration

## Frontend behavior

The desktop app can already surface backend status through:

- `networkStatusService`
- `maintenanceStatusService`
- remote config maintenance state
- emergency kill switches

Recommended degraded states:

- Realtime degraded: keep message composer usable, show reconnecting/degraded status.
- Uploads degraded: disable image upload button with clear explanation.
- Voice degraded: disable voice room join/screen share controls.
- Storage degraded: show attachment unavailable or upload paused copy.
- Backend unavailable: show backend unavailable banner without crashing mock UI.

## Startup policy

Backend startup or deployment should fail only when critical services are unavailable:

- Supabase Auth configuration missing in Supabase mode
- Supabase Postgres/RLS unavailable
- required Edge Function secret missing for a protected function that is being deployed

Backend startup should not fail for optional services:

- Redis in local/Supabase MVP mode
- email
- analytics/crash reporting
- auto-update metadata
- optional object-storage features when uploads are disabled

Optional service failures should:

- log a redacted warning
- mark the affected feature degraded or unavailable
- activate a narrow feature flag or emergency kill switch if needed
- keep core text chat flows available when possible

## Release and incident guidance

- Do not promote a release ring while `/health/ready` fails.
- Treat optional degraded status as a release risk, not always a blocker.
- If degraded optional services create user-facing breakage, pause rollout.
- Use `docs/safe-rollout.md` for rollout pause decisions.
- Use `docs/incident-response.md` for active incidents.
- Use `docs/emergency-kill-switches.md` to disable risky entry points temporarily.

## Production TODO

- Replace placeholder dependency status with real low-cost probes.
- Decide when Redis becomes required for realtime scaling.
- Add backend-side feature availability response if a future dedicated server is introduced.
- Add dashboards for readiness, degraded optional services, and release-ring impact.
- Add alert routing once monitoring is connected.

