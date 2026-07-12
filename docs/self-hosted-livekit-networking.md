# Self-Hosted LiveKit Networking

Status: **BLOCKED_PENDING_REAL_DNS_TLS_TURN_FIREWALL**

This document defines the staging network contract. No real domain, public IP, certificate, router, firewall, or external test network was supplied, so trusted WSS/TURN success is not claimed. Voice Rooms and Screen Share remain active V1 features; this missing evidence blocks public release only.

## Final reviewed single-host topology

| Port | Protocol | Public | Purpose |
| --- | --- | --- | --- |
| 80 | TCP | yes | Caddy ACME HTTP challenge and HTTPS redirect |
| 443 | TCP | yes | Caddy trusted HTTPS/WSS to loopback LiveKit `7880` |
| 7881 | TCP | yes | LiveKit ICE/TCP fallback |
| 3478 | UDP | yes | Embedded TURN/UDP and STUN |
| 5349 | TCP | yes | Embedded TURN/TLS with separate TURN hostname/certificate |
| 50000-60000 | UDP | yes | Direct WebRTC ICE/UDP media range |
| 7880 | TCP | no | Internal signal/API behind Caddy |
| 6379 | TCP | no | Loopback Redis only |
| 6789 | TCP | no | Loopback Prometheus metrics only |

UDP mux `7882` is not configured and must not be opened alongside the media range. SIP, Ingress, Egress, recording, and camera ports are out of scope.

## Important TURN/TLS limitation

The single-IP topology uses TCP `443` for Caddy/WSS and TCP `5349` for embedded TURN/TLS. LiveKit's production guidance recommends advertising TURN/TLS on `443` when no load balancer is present because TCP-443-only corporate networks may block `5349`. Therefore public release remains blocked until restricted-network Task 672 evidence passes.

If TCP-443-only TURN is required, choose and certify one of these before release:

- an approved L4/SNI load balancer that routes the primary hostname to Caddy and the TURN hostname to LiveKit while preserving end-to-end TLS; or
- a second public IP/interface so Caddy and TURN can bind TCP `443` independently.

Do not add an unreviewed Caddy L4 plugin or silently claim that `5349` equals TCP `443` coverage.

## DNS and certificates

- Primary and TURN FQDNs must be distinct and resolve to the approved staging endpoint.
- Caddy's official Ubuntu package manages trusted certificates and renewal for both names.
- The primary hostname reverse-proxies to `127.0.0.1:7880` with redacted authorization/cookie/query logs.
- The TURN hostname exposes only an HTTPS health response on Caddy `443`; its Caddy-managed certificate is independently SAN/expiry/private-key validated and copied to `/etc/picom-livekit/tls` for LiveKit TURN `5349`.
- A six-hour timer syncs renewed TURN material and restarts only the LiveKit service when content changes.
- Self-signed certificates are not accepted.

## Apply safely

1. Copy `infra/livekit/network/network.env.example` outside Git and fill real private operations values plus an exact approved Caddy apt version.
2. Confirm both DNS A records from at least two public resolvers before apply.
3. Keep console/recovery access open.
4. Run:

```bash
export PICOM_NETWORK_APPLY_CONFIRM=STAGING_ONLY
export PICOM_PUBLIC_PORTS_CONFIRM=OPEN_FINAL_PORT_MATRIX
sudo --preserve-env=PICOM_NETWORK_APPLY_CONFIRM,PICOM_PUBLIC_PORTS_CONFIRM \
  infra/livekit/network/configure-networking.sh /root/picom-livekit-network.env
sudo infra/livekit/network/verify-firewall.sh
```

The script refuses placeholder domains/IP/version, DNS mismatch, inactive/default-allow firewall, missing Task 661 config, or a changed port matrix. It installs only the official Caddy stable apt repository/package at the selected exact version.

## External tokenless check

Run from a machine outside the server LAN:

```bash
PICOM_EXTERNAL_NETWORK_CONFIRM=EXTERNAL_TEST_NETWORK \
PICOM_PRIMARY_HOSTNAME=<primary> \
PICOM_TURN_HOSTNAME=<turn> \
node scripts/self-hosted-livekit-external-connectivity.mjs --run
```

It verifies public DNS, trusted hostname-matching TLS with at least 30 days remaining, HTTPS/WSS fail-closed behavior without a token, ICE/TCP reachability, and TURN/TLS reachability. It does not print hostnames, addresses, certificates, or tokens.

Tokenless probes cannot prove ICE/UDP packets or authenticated TURN relay media. Tasks 671-672 must use controlled Picom clients and short-lived member tokens from separate LAN, outside-LAN, mobile-hotspot-like, VPN, UDP-blocked, and TCP-restricted networks.

## NAT/router notes

- A cloud VM with a directly associated public address is preferred.
- If NAT is unavoidable, forward only the reviewed public matrix to the staging host and confirm the advertised ICE address is the public address.
- Carrier-grade NAT without controllable inbound mappings is not supported for the server.
- Hairpin NAT is not release evidence; LAN clients should use split DNS or a router with verified hairpin behavior.
- IPv6 is disabled/not claimed until AAAA records, host binding, firewall parity, TURN, and representative clients are certified.

## Blocked proof

- Trusted public WSS and renewal: BLOCKED, no domain/host.
- Direct ICE/UDP and ICE/TCP: BLOCKED, no external clients.
- TURN/UDP and TURN/TLS relayed media: BLOCKED, requires authenticated client matrix.
- Restricted TCP-443-only network: BLOCKED; may require L4 load balancer/second IP topology.
- Minimum external exposure and internal-port denial: BLOCKED until real firewall and external scan.
