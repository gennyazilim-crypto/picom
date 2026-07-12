# Picom Self-Hosted LiveKit Amendment

Status date: 2026-07-12
Hosting mode: **SELF_HOSTED_LIVEKIT**
Product scope: **IN_V1**
Public-release readiness: **BLOCKED PENDING SELF-HOSTED CERTIFICATION**

## Decision

This amendment REPLACES the LiveKit Cloud operating model used by the earlier Task 657-668 sequence. No LiveKit Cloud subscription is required. Historical Task 642, Task 643, Task 644, Task 657, Task 658, and Task 668 checkpoints remain unchanged as evidence of prior decisions; they are not authority for the current hosting model.

Voice Rooms and Screen Share remain visible and included in Picom V1. Missing self-hosted infrastructure evidence blocks public release, not the product surface. A temporary infrastructure outage must show a clear unavailable state rather than silently hiding Voice channels or Settings.

## Environment separation

| Environment | Deployment | Credentials | Purpose |
| --- | --- | --- | --- |
| Development | Local LiveKit Server | Development-only | Local and LAN implementation |
| Staging | Dedicated Picom-controlled Linux host | Staging-only protected secrets | Internet, TURN, abuse, reconnect, and upgrade evidence |
| Production | Separate Picom-controlled Linux host | Production-only protected secrets | Public Windows-first V1 |

No API key, API secret, Redis password, TURN credential, TLS private key, SSH key, or production connection string belongs in source, renderer variables, packages, logs, screenshots, or checkpoints.

## Production baseline

- pinned LiveKit Server image/version, never latest;
- Linux host with Docker/Compose or approved systemd deployment;
- Redis isolated from the public network;
- public DNS and valid TLS for the signal and TURN design;
- ICE/TCP, TURN/UDP or TURN/TLS, and media UDP ports matching the final generated config;
- health, metrics, alerting, backup metadata, upgrade, rollback, incident, and secret-rotation ownership;
- Supabase Edge-issued short-lived tokens backed by active membership;
- no raw microphone or Screen Share recording/storage.

Official references:

- https://docs.livekit.io/transport/self-hosting/local/
- https://docs.livekit.io/transport/self-hosting/vm/
- https://docs.livekit.io/transport/self-hosting/ports-firewall/
- https://docs.livekit.io/transport/self-hosting/distributed/
- https://supabase.com/docs/guides/functions/secrets

## Release evidence sequence

Tasks 658-673 must provide the self-hosted host, local, Linux, Redis, DNS/TLS/TURN, secret, token, client, Screen Share, recovery, UI, operations, security, LAN, internet/NAT, and packaged-native evidence. Task 674 confirms inclusion without hiding the feature. Tasks 675-676 own immutable RC and final public Go/No-Go.

No public release is authorized by this amendment.
