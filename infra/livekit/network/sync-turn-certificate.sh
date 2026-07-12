#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

source /etc/picom-livekit/network.env
tls_dir="${PICOM_LIVEKIT_TLS_DIR:-/etc/picom-livekit/tls}"
[[ "${EUID}" -eq 0 ]] || { echo "Run as root through systemd or the approved operator path." >&2; exit 1; }
[[ "$PICOM_TURN_HOSTNAME" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "TURN hostname is invalid." >&2; exit 1; }

mapfile -t certificates < <(find /var/lib/caddy -type f -path "*/${PICOM_TURN_HOSTNAME}/${PICOM_TURN_HOSTNAME}.crt" 2>/dev/null)
mapfile -t keys < <(find /var/lib/caddy -type f -path "*/${PICOM_TURN_HOSTNAME}/${PICOM_TURN_HOSTNAME}.key" 2>/dev/null)
[[ "${#certificates[@]}" -eq 1 && "${#keys[@]}" -eq 1 ]] || { echo "Exactly one Caddy-managed TURN certificate/key pair is required." >&2; exit 1; }
openssl x509 -in "${certificates[0]}" -noout -checkhost "$PICOM_TURN_HOSTNAME" >/dev/null
openssl x509 -in "${certificates[0]}" -noout -checkend 2592000 >/dev/null || { echo "TURN certificate expires within 30 days." >&2; exit 1; }
openssl pkey -in "${keys[0]}" -check -noout >/dev/null

install -o root -g picom-livekit -m 0750 -d "$tls_dir"
changed=false
if [[ ! -f "$tls_dir/turn.crt" ]] || ! cmp -s "${certificates[0]}" "$tls_dir/turn.crt"; then
  install -o root -g picom-livekit -m 0640 "${certificates[0]}" "$tls_dir/turn.crt"
  changed=true
fi
if [[ ! -f "$tls_dir/turn.key" ]] || ! cmp -s "${keys[0]}" "$tls_dir/turn.key"; then
  install -o root -g picom-livekit -m 0640 "${keys[0]}" "$tls_dir/turn.key"
  changed=true
fi

if [[ "$changed" == true && -L /opt/picom-livekit/current ]]; then
  current="$(readlink -f /opt/picom-livekit/current)"
  if docker compose --project-name picom-livekit --env-file "$current/runtime.env" -f "$current/compose.yaml" ps -q livekit | grep -q .; then
    docker compose --project-name picom-livekit --env-file "$current/runtime.env" -f "$current/compose.yaml" restart --timeout 60 livekit >/dev/null
  fi
fi
echo "TURN certificate copy is current and valid; no key material was printed."
