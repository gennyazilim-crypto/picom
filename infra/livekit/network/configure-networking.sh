#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
input_env="${1:-}"
[[ "${EUID}" -eq 0 ]] || { echo "Run as root on the dedicated staging host." >&2; exit 1; }
[[ "${PICOM_NETWORK_APPLY_CONFIRM:-}" == "STAGING_ONLY" ]] || { echo "Set PICOM_NETWORK_APPLY_CONFIRM=STAGING_ONLY." >&2; exit 1; }
[[ "${PICOM_PUBLIC_PORTS_CONFIRM:-}" == "OPEN_FINAL_PORT_MATRIX" ]] || { echo "Set PICOM_PUBLIC_PORTS_CONFIRM=OPEN_FINAL_PORT_MATRIX." >&2; exit 1; }
[[ -f "$input_env" ]] || { echo "Provide a protected host-local network environment file." >&2; exit 1; }
# shellcheck disable=SC1090
source "$input_env"

hostname_pattern='^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$'
[[ "$PICOM_PRIMARY_HOSTNAME" =~ $hostname_pattern && "$PICOM_TURN_HOSTNAME" =~ $hostname_pattern && "$PICOM_PRIMARY_HOSTNAME" != "$PICOM_TURN_HOSTNAME" ]] || { echo "Primary/TURN hostnames must be distinct public FQDNs." >&2; exit 1; }
[[ "$PICOM_EXPECTED_PUBLIC_IPV4" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo "Expected public IPv4 is invalid." >&2; exit 1; }
[[ "$PICOM_CADDY_VERSION" != REPLACE_* && "$PICOM_CADDY_VERSION" =~ ^[A-Za-z0-9.+:~_-]+$ ]] || { echo "Exact approved Caddy apt version is required." >&2; exit 1; }
[[ "$PICOM_TURN_TLS_PORT" == 5349 && "$PICOM_TURN_UDP_PORT" == 3478 && "$PICOM_RTC_TCP_PORT" == 7881 && "$PICOM_RTC_UDP_START" == 50000 && "$PICOM_RTC_UDP_END" == 60000 ]] || { echo "Network file does not match the reviewed port topology." >&2; exit 1; }

for name in "$PICOM_PRIMARY_HOSTNAME" "$PICOM_TURN_HOSTNAME"; do
  mapfile -t resolved < <(getent ahostsv4 "$name" | awk '{print $1}' | sort -u)
  [[ "${#resolved[@]}" -eq 1 && "${resolved[0]}" == "$PICOM_EXPECTED_PUBLIC_IPV4" ]] || { echo "DNS A record does not match the approved staging address." >&2; exit 1; }
done

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg openssl
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
chmod 0644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y "caddy=${PICOM_CADDY_VERSION}"
apt-mark hold caddy

install -o root -g picom-livekit -m 0640 "$input_env" /etc/picom-livekit/network.env
install -o root -g root -m 0644 "$repo_root/infra/livekit/network/Caddyfile" /etc/caddy/Caddyfile
install -o root -g root -m 0755 -d /etc/systemd/system/caddy.service.d /var/log/caddy
chown caddy:caddy /var/log/caddy
install -o root -g root -m 0644 "$repo_root/infra/livekit/network/caddy-systemd-override.conf" /etc/systemd/system/caddy.service.d/10-picom-livekit.conf
install -o root -g root -m 0755 "$repo_root/infra/livekit/network/sync-turn-certificate.sh" /usr/local/sbin/picom-turn-certificate-sync
install -o root -g root -m 0644 "$repo_root/infra/livekit/network/picom-turn-certificate-sync.service" /etc/systemd/system/picom-turn-certificate-sync.service
install -o root -g root -m 0644 "$repo_root/infra/livekit/network/picom-turn-certificate-sync.timer" /etc/systemd/system/picom-turn-certificate-sync.timer

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
ufw status verbose | grep -q '^Status: active' || { echo "Task 660 active firewall is required." >&2; exit 1; }
ufw allow 80/tcp comment 'Picom Caddy ACME and redirect'
ufw allow 443/tcp comment 'Picom trusted WSS'
ufw allow 7881/tcp comment 'Picom WebRTC ICE TCP'
ufw allow 3478/udp comment 'Picom embedded TURN UDP'
ufw allow 5349/tcp comment 'Picom embedded TURN TLS'
ufw allow 50000:60000/udp comment 'Picom WebRTC ICE UDP range'
ufw deny 7880/tcp comment 'Picom internal signal API'
ufw deny 6379/tcp comment 'Picom internal Redis'
ufw deny 6789/tcp comment 'Picom internal metrics'
ufw reload

secret_config=/etc/picom-livekit/secrets/livekit.yaml
[[ -f "$secret_config" ]] || { echo "Task 661 LiveKit secret config is missing." >&2; exit 1; }
python3 - "$secret_config" "$PICOM_TURN_HOSTNAME" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
hostname = sys.argv[2]
text = path.read_text()
old = "turn:\n  enabled: false"
new = f'''turn:\n  enabled: true\n  domain: "{hostname}"\n  cert_file: /run/picom-tls/turn.crt\n  key_file: /run/picom-tls/turn.key\n  tls_port: 5349\n  udp_port: 3478'''
if old not in text and new not in text:
    raise SystemExit("LiveKit TURN block is not in an approved state")
path.write_text(text.replace(old, new))
PY
chown root:picom-livekit "$secret_config"
chmod 0640 "$secret_config"

systemctl daemon-reload
systemctl enable --now caddy
for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error --max-time 5 "https://${PICOM_TURN_HOSTNAME}/health" >/dev/null 2>&1; then break; fi
  [[ "$attempt" -lt 60 ]] || { echo "Trusted Caddy certificate issuance did not complete." >&2; exit 1; }
  sleep 5
done
/usr/local/sbin/picom-turn-certificate-sync
systemctl enable --now picom-turn-certificate-sync.timer
echo "Staging DNS/TLS/TURN/firewall configuration applied without printing hostnames, addresses, or credentials."
