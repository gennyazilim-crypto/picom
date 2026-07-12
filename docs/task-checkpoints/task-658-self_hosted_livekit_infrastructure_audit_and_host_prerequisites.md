# Task 658 Checkpoint: Self-Hosted LiveKit Infrastructure Audit and Host Prerequisites

## Result

**PARTIAL PASS - local development host ready; staging/production infrastructure BLOCKED; Voice remains IN_V1.**

## Observed local capability

- Windows 11 x64 with 16 logical processors and about 16 GiB system RAM.
- Docker Desktop Linux engine/WSL2 is running with 16 CPUs and about 7.4 GiB assigned memory.
- Outbound DNS and TLS 443 work.
- LiveKit/Redis binaries are not installed on the Windows PATH.
- Default LiveKit ports are occupied by an unrelated user-owned container; it was not inspected, stopped, reused, or changed.
- A Picom-specific isolated local stack is approved for Task 659.

## Selected strategy

- Development: isolated local Docker stack.
- Staging: dedicated public Linux VM.
- Production: separate dedicated public Linux VM.
- Initial topology: single LiveKit node plus Redis per environment.
- Multi-node/Kubernetes: deferred until measured capacity/availability requires it.

## Blocked evidence

- dedicated staging and production Linux hosts;
- macOS native device;
- public inbound IP/NAT and firewall control;
- Picom-controlled DNS/domain and TLS;
- measured upload/egress bandwidth;
- monitoring, backup, cost, incident, rotation, and release owners.

## Evidence

- docs/self-hosted-livekit-infrastructure-audit.md
- docs/self-hosted-livekit-capacity-plan.md
- docs/evidence/task-658-self-hosted-infrastructure-redacted.json

No credential, IP address, private host detail, or raw media was recorded.

## Validation

- Task 658 infrastructure audit smoke
- Existing Task 657 architecture contract

## Next

Task 659 may create an isolated local Picom LiveKit development server without touching existing user containers. Public deployment remains blocked.
