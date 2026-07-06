# Service Level Objectives Plan

Picom is an Electron desktop community chat app for Windows, Linux, and macOS backed by Supabase, Postgres, Storage, Realtime, and LiveKit/WebRTC for voice and screen sharing. This plan defines placeholder reliability targets for beta and production launch discipline.

These SLOs are planning targets until production telemetry and support volume establish real baselines. No mobile targets are included.

## SLO table

| SLO | Target | Measurement method | Alert threshold placeholder | User impact | Owner placeholder | Rollback criteria |
| --- | ---: | --- | --- | --- | --- | --- |
| Backend API uptime | 99.5% monthly | `/health`, `/health/live`, `/health/ready`, API synthetic checks | 5 min readiness failure or 1% error rate over 15 min | Login, community loading, message fetch/send can fail | Operations | Roll back backend release if failure began after deploy and health does not recover in 15 min. |
| Auth success rate | 99.0% of valid login/register/session restore attempts | Supabase Auth success/error counters, desktop auth logs without secrets | Valid auth failures > 2% over 15 min | Users cannot enter the desktop app or lose sessions | Engineering/Auth | Pause rollout and roll back auth-related changes if failures spike after release. |
| Message send success rate | 99.0% of eligible message sends | Message API/Realtime confirmation, client optimistic failure telemetry placeholder | Send failures > 3% over 10 min | Core chat appears broken; queued/failed messages rise | Engineering/Realtime | Disable risky message-edit/realtime features via kill switch or roll back API. |
| Realtime connection stability | 98.5% clients connected or recovered within 30s | Realtime connection status events, reconnect counters | Reconnect failures > 5% over 15 min | Messages feel delayed; typing/presence becomes stale | Engineering/Realtime | Fall back to API polling/degraded banner and roll back realtime gateway changes. |
| Attachment upload success rate | 98.0% of valid uploads | Supabase Storage/attachment service success rate, client upload errors | Upload failures > 5% over 15 min | Image sharing fails; users may retry repeatedly | Engineering/Storage | Disable uploads with kill switch if storage or validation regression is suspected. |
| Desktop crash-free sessions placeholder | 99.0% crash-free sessions | Crash recovery records, diagnostics exports, future crash reporting | Crash-free sessions < 98% for a release ring | Users lose work or cannot start Picom reliably | Desktop Engineering | Pause rollout, publish hotfix or roll back desktop package if startup crashes increase. |
| Notification delivery placeholder | 95.0% eligible notification attempts surfaced or recorded | NotificationService decisions, native/browser permission state, inbox placeholder | Missed eligible notifications > 10% sampled | Mentions/direct-message placeholders may be missed | Desktop Engineering | Disable native notification path if it causes crashes; keep inbox recording. |
| Database availability | 99.5% monthly | Postgres health/readiness, query latency, migration status | DB unreachable for 3 min or p95 query latency > 1s for 15 min | Almost all backend data flows fail | Operations/Database | Stop deploy, restore service, evaluate rollback only if migration is safe. |
| Redis availability | 99.0% monthly when enabled | Redis ping/readiness, realtime adapter status | Redis unavailable for 5 min in production mode | Realtime rooms/presence scaling degrade | Operations/Realtime | Degrade to single-instance/in-memory fallback only if safe; otherwise pause rollout. |
| Object storage availability | 99.0% monthly | Supabase Storage/object storage checks, upload/download probes | Storage read/write failures > 5% over 15 min | Attachments cannot upload or preview | Operations/Storage | Disable uploads/download previews if unsafe; roll back storage config changes. |
| LiveKit voice room join success | 97.5% valid room joins | Token Edge Function success, LiveKit client connection status | Join failures > 8% over 15 min | Voice rooms/screen share MVP becomes unreliable | Engineering/Voice | Disable voice entry points if failures affect core desktop stability. |

## Measurement principles

- Do not log message bodies, passwords, tokens, or private channel content.
- Use request IDs and redacted metadata for operational correlation.
- Keep desktop app diagnostics opt-in/privacy-safe until a production telemetry policy is finalized.
- Separate backend availability from desktop crash-free sessions; both are user-visible but fixed differently.
- Treat Supabase CLI absence in local development as a tooling gap, not a production SLO signal.

## Error budget policy placeholder

- Beta releases can tolerate temporary SLO misses if they are documented and do not block core chat.
- Stable releases should pause rollout when any core SLO exceeds its alert threshold for more than one evaluation window.
- Security or private-channel access leaks override all SLO math and trigger incident response immediately.

## Alert routing placeholder

- Backend/API/Database/Storage: Operations primary, Engineering secondary.
- Auth/Message/Realtime/Voice: Engineering primary, Operations secondary.
- Desktop crash-free sessions/notifications: Desktop Engineering primary, Support secondary.
- Security or privacy incidents: Security owner placeholder plus Engineering and Operations.

## Release usage

Before a beta or stable release, confirm:

1. Health/readiness endpoints are passing.
2. Staging smoke test passes.
3. Message send and realtime two-window test pass.
4. Attachment upload smoke test passes.
5. Desktop crash recovery does not trigger on clean startup.
6. Rollback and kill-switch procedures are ready.
7. Known SLO risks are listed in release notes.

## Open TODOs

- Replace placeholder targets with baseline data after beta telemetry and support reports exist.
- Wire production dashboards and alerts without collecting sensitive content.
- Define final owners once the operations/support rotation is real.
- Add CI/release links to bundle-size, staging smoke, and incident-response workflows.
