# Picom V1 LiveKit Production Environment

Status date: 2026-07-12  
Task result: **PARTIALLY PROVISIONED - hosted staging usable; production governance BLOCKED**

This is the public, redacted provider control record. It contains no API key, API secret, participant token, private room identifier, account email, or captured media.

## Provisioned provider boundary

| Environment | LiveKit Cloud project | Public WSS endpoint | Agent observability | API credential boundary |
| --- | --- | --- | --- | --- |
| Staging | `Picom Staging` | `wss://picom-blmsm07k.livekit.cloud` | Disabled | One project-local credential exists; value was not read or exported in Task 658 |
| Production | `Picom Production` | `wss://picom-production-czs6d3th.livekit.cloud` | Disabled | One distinct project-local credential exists; value was not read or exported in Task 658 |

The previous generic `Picom` project was explicitly renamed to `Picom Staging`. `Picom Production` was created as a separate project. Free quota is shared by the account, but room, endpoint, and credential namespaces are separate.

## Safe dashboard configuration

- Provider: LiveKit Cloud managed global mesh.
- Plan: `build` for both projects under the current account subscription.
- Automatically create rooms on first participant join: enabled.
- Provider sandbox token server: disabled; Picom must use its authenticated Edge Function.
- Admin remote unmute option: disabled.
- Agent observability: disabled in both environments, preventing provider-side agent transcript/audio capture by default.
- Opus, Audio RED, H.264, VP8, VP9, and AV1 are enabled by provider defaults. Picom V1 tokens still prohibit camera publication.
- Egress/recording is not configured or used by Picom V1.

## Region and data-residency decision

LiveKit Cloud's default endpoint routes each client to the closest healthy edge. This is the selected staging behavior because it provides Germany/EU proximity and automatic failover without custom infrastructure.

EU-only protocol region pinning is **not enabled**. LiveKit documents region pinning as a Scale-plan-or-higher feature and notes that it trades global failover for regional isolation. A production legal/data-residency requirement must therefore choose one of these before public release:

1. approve global edge routing with the documented privacy basis; or
2. upgrade and request EU region pinning (`eu`, France/Germany with in-region redundancy).

References:

- https://docs.livekit.io/deploy/admin/regions/
- https://docs.livekit.io/deploy/admin/regions/region-pinning/

## Capacity and cost record

Dashboard quota observed for each Build project:

| Resource | Current limit |
| --- | ---: |
| Concurrent participants | 100 |
| Concurrent Egress requests | 2 |
| Concurrent Ingress requests | 2 |
| Concurrent agent sessions | 5 |
| Deployed agents | 1 |

LiveKit documents Build allowance as a hard cap: new requests fail after included allowance is consumed. Media subscription limits are 100 audio and 100 video tracks per participant. Picom does not depend on Egress/Ingress for Voice Rooms or Screen Share.

- Current next invoice shown by the production dashboard: `$0.00`.
- Provider cost alerts: not configured/evidenced.
- Production budget and billing owner: not formally assigned.
- Required operating thresholds: warning at 50%, elevated at 75%, admission/release review at 90% of approved monthly budget or participant allowance.

The Build plan is acceptable for protected staging and a small two-client certification. It is not approved as Picom's public production capacity plan.

Reference: https://docs.livekit.io/deploy/admin/quotas-and-limits/

## TURN and network behavior

LiveKit Cloud provides ICE/UDP, TURN/UDP, ICE/TCP, and TURN/TLS fallback. Required network access is documented at:

- `*.livekit.cloud` TCP 443 for secure WebSocket signaling;
- `*.turn.livekit.cloud` TCP 443 for TURN/TLS;
- `*.host.livekit.cloud` UDP 3478 for TURN/UDP;
- recommended UDP 50000-60000 and TCP 7881 for media fallback.

References:

- https://docs.livekit.io/intro/basics/connect/
- https://docs.livekit.io/deploy/admin/firewall/

Task 658 safe reachability result from the operator workstation:

| Endpoint | DNS | TCP 443 | HTTPS/TLS |
| --- | --- | --- | --- |
| Staging | PASS | PASS | PASS (HTTP 200) |
| Production | PASS | PASS | PASS (HTTP 200) |

This proves public endpoint/DNS/TLS reachability only. TURN, UDP, packet loss, two-client media, and packaged Windows behavior remain Tasks 665-667 evidence.

## Ownership and custody

- A currently authenticated provider account created/controls both projects.
- No verified backup provider administrator was available in the dashboard evidence.
- Billing, rotation, incident, and emergency-revoke owners are not formally assigned in the private operations register.
- API secrets were not revealed, copied, printed, downloaded, or committed during Task 658.
- Runtime secret installation moves to the protected Supabase flow in Task 659.

The missing backup/operations ownership and production secret destination keep the production environment gate **BLOCKED**. They do not prevent protected staging implementation and two-client testing.

## Canonical runtime contract

- Room name: `community:<communityId>:voice:<channelId>`.
- Participant identity: authenticated Supabase `auth.uid()`.
- Token TTL: 600 seconds.
- Ordinary media access: every authenticated active community member may join, publish microphone audio, publish a selected Screen Share, and subscribe to remote tracks.
- Owner/Admin/Moderator/custom-role grants are used only for moderation.
- Visitor, pending, removed, banned, suspended, ended-room, and provider-unavailable states fail closed.
- Provider credentials remain server/Edge only.

## Release status

| Gate | Result |
| --- | --- |
| Dedicated staging project | PASS_REAL |
| Dedicated production project | PASS_REAL |
| Distinct provider credential namespaces | PASS_REAL |
| Observability disabled | PASS_REAL |
| Public endpoint DNS/TLS | PASS_REAL |
| Protected staging secret installation | PENDING_TASK_659 |
| Region/data-residency approval | BLOCKED |
| Production plan/capacity approval | BLOCKED |
| Backup owner and cost owner | BLOCKED |
| Hosted multi-client media | PASS_REAL - run 29197503222 |
| Packaged Windows media | PASS_REAL - run 29198913461 |

Task 668 includes Voice/Screen in V1 after the hosted, packaged-Windows, and security gates passed. Production region, capacity, billing, backup, and custody approvals remain public-release blockers.
