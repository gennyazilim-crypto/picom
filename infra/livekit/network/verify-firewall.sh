#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "${EUID}" -eq 0 ]] || { echo "Run as root on the staging host." >&2; exit 1; }
rules="$(ufw status numbered)"
for required in '80/tcp.*ALLOW' '443/tcp.*ALLOW' '7881/tcp.*ALLOW' '3478/udp.*ALLOW' '5349/tcp.*ALLOW' '50000:60000/udp.*ALLOW'; do
  grep -Eq "$required" <<<"$rules" || { echo "A required public firewall rule is missing." >&2; exit 1; }
done
for internal in '7880/tcp.*DENY' '6379/tcp.*DENY' '6789/tcp.*DENY'; do
  grep -Eq "$internal" <<<"$rules" || { echo "An internal-only firewall deny rule is missing." >&2; exit 1; }
done
docker compose --project-name picom-livekit -f /opt/picom-livekit/current/compose.yaml config | grep -q 'network_mode: host'
if docker compose --project-name picom-livekit -f /opt/picom-livekit/current/compose.yaml config | grep -q 'published:'; then echo "Compose unexpectedly publishes a port." >&2; exit 1; fi
echo "Firewall/Compose port contract passed; raw rules, addresses, and hostnames were not printed."
