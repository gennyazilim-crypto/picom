# Self-Hosted LiveKit Infrastructure Audit

Audit date: 2026-07-12
Hosting mode: **SELF_HOSTED_LIVEKIT**
Product scope: **Voice Rooms and Screen Share remain IN_V1 and visible**
Infrastructure result: **LOCAL DEVELOPMENT READY / PUBLIC STAGING AND PRODUCTION BLOCKED**

## Safe local evidence

| Area | Observed result | Decision |
| --- | --- | --- |
| Desktop host | Windows 11 x64, 16 logical processors, about 16 GiB system RAM | Suitable for local development, not production |
| Container runtime | Docker Desktop with Linux engine/WSL2 is running | PASS_LOCAL |
| Docker allocation | 16 CPUs exposed, about 7.4 GiB memory | Suitable for a bounded local two-client test |
| Disk | Approximately 20-40 GiB free band | Sufficient for local images/logs with cleanup; not a production sizing claim |
| LiveKit binary | Not installed on Windows PATH | Docker image is the approved local path |
| Redis binary | Not installed on Windows PATH | Dedicated container is the approved local path |
| Outbound DNS/TLS | Official LiveKit documentation resolves and TCP 443 succeeds | PASS_LOCAL |
| Existing 7880/7881 use | An unrelated user-owned LiveKit container already owns the default ports | Picom must use isolated names/network/ports; existing container is untouched |
| General Linux VM | No dedicated Linux host or SSH target evidenced | BLOCKED |
| macOS device | No native Mac evidenced | BLOCKED for Tasks 671/673 |
| Public inbound/NAT | Not verified | BLOCKED |
| Domain/DNS control | Not verified | BLOCKED |
| Upload bandwidth | Not measured | BLOCKED |

No public IP, private address, host name, container environment, secret, credential, or key value was recorded.

## Selected host strategy

### Development

Run a Picom-specific local LiveKit Server and Redis deployment through Docker Desktop. It must use a dedicated Compose project, network, volumes, ports, and development-only credentials. It must not stop, inspect, reuse, or mutate the unrelated existing LiveKit/Redis/Supabase containers.

### Staging

Provision one dedicated public Linux VM controlled by Picom. Staging requires its own DNS names, TLS certificates, LiveKit keys, Redis password, TURN configuration, monitoring, backup metadata, and Supabase staging secrets.

### Production

Provision a separate dedicated public Linux VM and credentials. Production must not share a VM, Redis instance, key pair, TURN credential, TLS private key, domain, or Supabase secret set with development or staging.

Using one existing Linux server for both staging and production is rejected because environment isolation cannot be proven. Separate VMs are required for the first public release.

## Single-node first

A single LiveKit node plus Redis is the selected initial topology for each environment. Kubernetes/multi-node is not justified until measured room concurrency, host saturation, availability objectives, or maintenance requirements exceed one-node thresholds. Redis remains required by this pack for production coordination and an upgrade path.

## Required network and platform evidence

- primary signal hostname and TURN hostname under Picom-controlled DNS;
- valid automated TLS matching both final hostnames;
- only final-config ports opened: typically TCP 80/443/7881, UDP 3478 and UDP 50000-60000, or a documented UDP-mux alternative;
- internal API port 7880 and Redis 6379 not publicly exposed;
- public IPv4/NAT mapping and IPv6 decision;
- symmetric upload and egress capacity measured from the actual VM;
- SSH keys, non-root operator access, host firewall, unattended security updates, time sync, and intrusion protection;
- monitoring, alert, backup metadata, upgrade, rollback, incident, billing, and rotation owners.

## Operator ownership

The host, network/DNS, TLS, Redis, monitoring, backup, security incident, secret rotation, bandwidth/cost, and release approval owners are currently **UNASSIGNED**. Public release remains No-Go until private ownership records are assigned without adding personal contact data to this repository.

## Official references

- https://docs.livekit.io/transport/self-hosting/local/
- https://docs.livekit.io/transport/self-hosting/vm/
- https://docs.livekit.io/transport/self-hosting/ports-firewall/
- https://docs.livekit.io/transport/self-hosting/distributed/

## Decision

Local implementation may proceed in Task 659. Staging/production deployment cannot begin until a real Linux host, DNS control, firewall/NAT control, and approved operator path exist. This infrastructure block does not hide or disable the V1 Voice Room UI.
