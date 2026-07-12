# Self-Hosted LiveKit Capacity Plan

Status: **PROVISIONAL UNTIL TASKS 671-672 MEASURE REAL MEDIA**

This plan does not invent Picom user counts. It defines measurable capacity bands and formulas that must be populated from real LAN and internet/TURN evidence.

## Workload variables

- R: concurrent Voice Rooms
- P: average connected participants per room
- A: measured per-publisher audio bitrate including transport overhead
- S: simultaneous Screen Share publishers
- V: average subscribers per Screen Share
- B: measured average Screen Share bitrate including transport overhead
- H: headroom factor, minimum planning value 1.5 until real p95 data exists

Approximate server egress planning:

audio_egress = R * P * (P - 1) * A

screen_egress = S * V * B

planned_egress = (audio_egress + screen_egress) * H

Task 671 must measure A and B on LAN. Task 672 must measure direct and TURN-relayed p50/p95 bitrate, packet loss, join latency, reconnect rate, and server CPU/memory/network.

## Initial sizing candidates

These are procurement starting points, not certified capacity.

| Environment | Candidate baseline | Storage | Network | Status |
| --- | --- | --- | --- | --- |
| Local development | Existing Docker Desktop allocation, bounded two-client use | Local ephemeral volumes | Loopback/LAN only | AVAILABLE |
| Staging | 4 dedicated vCPU, 8 GiB RAM | 80 GiB SSD minimum | Public symmetric 1 Gbps candidate | BLOCKED pending host |
| Production | 8 dedicated vCPU, 16 GiB RAM | 160 GiB SSD minimum | Public symmetric 1 Gbps candidate with transfer budget | BLOCKED pending load evidence and approval |

The production candidate must be increased if Task 672 p95 CPU exceeds 60%, memory exceeds 70%, packet loss exceeds 1%, or network egress exceeds 50% of sustained interface/provider limits during the approved certification workload.

## Capacity bands

| Band | Purpose | Admission rule |
| --- | --- | --- |
| Certification | One room, two clients, one or more controlled shares | Required for Tasks 671-673 |
| Internal beta | Measured workload approved by the capacity owner | No public users until p95 metrics and rollback pass |
| Stable rollout | Explicit R/P/S/V values from beta evidence | Release gate requires at least 50% measured headroom |
| Scale review | Node saturation or availability objective requires redundancy | Evaluate multi-node Redis-backed deployment; do not jump to Kubernetes without evidence |

## Alerts

- LiveKit process/container unavailable for two consecutive probes;
- Redis unavailable, authentication failure, or memory pressure;
- CPU above 70% for 10 minutes;
- memory above 75% for 10 minutes;
- host disk above 75% or log growth above budget;
- network egress above 70% of approved sustained capacity;
- packet loss above 2% or reconnect error rate above the approved beta baseline;
- TURN relay ratio or TURN failure rate outside the Task 672 baseline;
- TLS certificate expiry inside 30 days;
- abnormal token denial/rate-limit/moderation/error growth.

## Bandwidth and cost ownership

Monthly transfer allowance, overage rate, VM cost, domain/TLS cost, backup cost, and alert destinations are **UNASSIGNED**. The capacity owner must approve a monthly ceiling and 50/75/90-percent budget alerts before public beta.

## Backup boundary

Back up versioned configuration, encrypted secret metadata references, Redis recovery policy, monitoring rules, and deployment manifests. Do not back up or capture raw microphone audio or Screen Share media.
