# Task 660 Checkpoint: Production Linux Host Hardening and Docker Runtime

## Status

Host automation and rollback contract: **PASS**

Execution on dedicated Linux staging host: **BLOCKED_PENDING_REAL_LINUX_HOST_EXECUTION**

Voice Rooms and Screen Share remain active in V1. This blocker applies to public release infrastructure evidence only.

## Delivered

- Ubuntu 24.04 LTS `x86_64` target contract.
- Exact Docker/Compose package-version inputs using the official Docker apt repository.
- Non-root deployment operator and non-login media service identity.
- Strict deployment, secret, data, log, and backup directory permissions.
- Explicitly confirmed SSH key-only hardening with syntax validation.
- Explicitly confirmed default-deny firewall with SSH only; no LiveKit port opens.
- Chrony, unattended official security updates, bounded Docker/Picom logs, disk/time/runtime timer.
- Redacted prerequisite/resource/throughput evidence generator.
- Managed-file snapshots and non-destructive rollback.

## Validation

- `npm run livekit:host:contract`: PASS
- Host shell contract syntax/static assertions: PASS
- Task 659 local Voice/Screen regression: PASS
- Real Ubuntu host preparation: BLOCKED, no host/SSH target supplied
- Real network throughput: BLOCKED, no controlled target supplied

Redacted contract evidence: `docs/evidence/task-660-linux-host-hardening-contract.json`.

## Security notes

- No credential, hostname, IP address, SSH key, Docker registry value, or production connection string is committed.
- `picom-deploy` is not placed in the Docker group.
- Docker/UFW bypass risk is deferred to the final reviewed Task 662 firewall/DOCKER-USER policy.
- No LiveKit/TURN/Redis/media port is opened by Task 660.
