# First 72 Hours Monitoring

Status date: 2026-07-10  
Monitoring window: **Not started - no stable release was distributed**

The active No-Go decision prevented stable distribution. Therefore no 24-72 hour production trend, adoption metric, platform issue rate, support theme, or security/privacy report can be truthfully calculated.

## Future 72-hour review schedule

| Window | Review focus | Required output |
| --- | --- | --- |
| 0-24h | Startup, auth, message, upload, realtime, voice, screen share, install, RLS/security | Immediate blocker/hotfix decision |
| 24-48h | Recurrence, platform/version clusters, provider health, support duplicates | Trend and mitigation ownership |
| 48-72h | Burn rate, unresolved critical/major issues, rollback effectiveness, backlog themes | Stability decision and prioritized follow-up |

## Required comparisons

- Crash/error trend by app version, release channel, Windows/Linux/macOS, and safe privacy-preserving dimensions.
- Login/register/session failures and Supabase status.
- Message/realtime/upload success and error-code trends.
- LiveKit token/join/device/reconnect and screen-share permission/stop issues.
- Installer, signature/notarization, upgrade/reinstall, and uninstall issues.
- Support categories, duplicate clusters, and known-issue deflection.
- Abuse/RLS/private-data alerts without storing message content or secrets.
- Aggregate adoption only if approved telemetry exists; no invasive per-user behavior tracking.

## Prioritization rule

- P0: private-data leak, secret exposure, launch/login/message blocker, corrupt package/data, or critical voice/screen-share crash promised by release.
- P1: widespread degraded core flow with workaround.
- P2: contained platform/UI/performance issue.
- Backlog: non-critical enhancement or feature request.

## Current result

No hotfix or backlog item is attributed to launch telemetry because no launch happened. Carry forward the pre-release blockers from `docs/release-blockers.md`; update this report only after a future Go release completes a real 72-hour window.
