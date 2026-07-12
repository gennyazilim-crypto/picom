# Task 662 Checkpoint: DNS TLS TURN and Firewall Production Connectivity

## Status

Network/TLS/firewall contract: **PASS**

Real DNS, trusted certificate, external ICE/TURN and restricted-network evidence: **BLOCKED_PENDING_REAL_DNS_TLS_TURN_FIREWALL**

Voice Rooms and Screen Share remain active V1 capabilities.

## Delivered

- Separate primary and TURN hostname contract.
- Official, exact-version Caddy package path with automatic trusted certificate management.
- Redacted WSS reverse proxy to internal `7880`.
- SAN/expiry/private-key-validated TURN certificate sync and renewal timer.
- Embedded TURN/UDP `3478`, TURN/TLS `5349`, ICE/TCP `7881`, ICE/UDP `50000-60000` configuration path.
- Explicit public allow and internal deny firewall matrix.
- Compose TLS mount and host-network/no-published-port verification.
- Tokenless external DNS/TLS/WSS/TCP connectivity probe.
- NAT, hairpin, IPv6, and TCP-443-only TURN limitations documented.

## Validation

- `npm run livekit:network:contract`: PASS
- Ubuntu 24.04 shell syntax validation: PASS
- Task 661 Compose schema regression: PASS
- Tokenless script safe blocked mode: PASS
- Real DNS/certificate/WSS: BLOCKED, no values/host
- ICE/UDP, TURN/UDP, TURN/TLS relayed media: BLOCKED, no external authenticated clients
- Restricted network and TCP-443-only TURN: BLOCKED

Redacted contract evidence: `docs/evidence/task-662-network-contract.json`.

## Release impact

Public release remains No-Go until trusted WSS, direct UDP/TCP, TURN relay, external port scan, and renewal evidence pass. This No-Go must not hide or remove the Voice Room UI.
