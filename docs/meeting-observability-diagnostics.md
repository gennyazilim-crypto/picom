# Meeting Observability, Diagnostics, and Support Evidence

## Collection policy

Picom keeps a bounded, in-memory, aggregate meeting diagnostics summary. It is not remote analytics. The summary is included in a support report only when the user explicitly selects diagnostics or explicitly exports diagnostics. There is no automatic upload endpoint in this task.

The summary contains app version, commit short hash, build date, release channel, platform/runtime, safe device capability booleans, configured provider region label, meeting state counters, latency buckets, participant counts, connection-quality counts, and allowlisted error codes/domains.

It never contains room/session/user identifiers, participant names, provider identity, device identifiers, media, frames, tracks, chat bodies, attachments, caption/transcript text, tokens, URLs with credentials, full provider responses, or session objects.

## Client metrics

- Token failures and join attempt/success/failure counts.
- Join latency bucket: under 1 second, 1-3 seconds, 3-8 seconds, or over 8 seconds.
- Connection-state transition counts and last transition.
- Reconnect count.
- Current and peak participant count without identities.
- Current connection-quality distribution.
- Microphone/camera/screen track publish failure counts.
- Screen-share failure count.
- Caption failure count.
- Last redacted error code, operation, and failure domain.
- Device capability booleans for capture API, Electron screen picker, noise suppression, echo cancellation, and automatic gain control.

## Failure classification

`provider` covers token/provider/room connection failures; `network` covers offline, timeout, and reconnect exhaustion; `client_permission` and `client_device` cover local OS/device issues; `access_policy` covers waiting, permission, moderation, and revoked access; `configuration` covers missing provider setup. A single client can identify the likely domain but cannot declare a global provider outage.

## Hosted dashboards and alerts

Hosted aggregation must be opt-in, pseudonymous, region-bucketed, and content-free. Proposed dashboards:

| Signal | Warning | Critical | Primary owner |
| --- | --- | --- | --- |
| Token failure rate | > 3% for 10 min | > 8% for 5 min | Realtime platform |
| Join p95 | > 5 sec for 15 min | > 8 sec for 10 min | Desktop + platform |
| Reconnecting sessions | > 8% for 10 min | > 15% for 5 min | Realtime platform |
| Track publish failures | > 3% for 15 min | > 8% for 10 min | Media platform |
| Screen-share failures | > 5% for 15 min | > 12% for 10 min | Desktop platform |
| Caption failures, configured rooms only | > 8% for 15 min | > 20% for 10 min | Caption provider owner |

Provider outage suspicion requires correlated failures across multiple opted-in clients in the same provider region while client permission/device errors remain normal. Client-only failures must not page the provider team.

## Support workflow

1. User selects Include diagnostics or Export diagnostics.
2. `diagnosticsService` merges the meeting aggregate with existing app/runtime/service evidence.
3. `loggingService.redactDiagnosticsValue` applies centralized secret/private-content redaction.
4. The user reviews and saves/copies the support payload through the existing feedback flow.
5. Support compares failure domain, build metadata, provider region, transitions, latency bucket, and device capabilities without requesting media or secrets.

## External evidence blocker

Hosted dashboards, alert routing, regional provider correlation, and real support case evidence require an approved telemetry processor, retention policy, opt-in UI/legal wording, and staging/production infrastructure. They remain BLOCKED; this task does not fabricate them.
