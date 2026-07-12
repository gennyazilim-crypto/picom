#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
source_compose="$repo_root/infra/livekit/compose/compose.yaml"
secret_dir="${PICOM_LIVEKIT_SECRET_DIR:-/etc/picom-livekit/secrets}"
release_id="${PICOM_RELEASE_ID:-}"
[[ "${EUID}" -eq 0 ]] || { echo "Run as root through the approved deployment path." >&2; exit 1; }
[[ "${PICOM_DEPLOY_CONFIRM:-}" == "STAGING_ONLY" ]] || { echo "Set PICOM_DEPLOY_CONFIRM=STAGING_ONLY." >&2; exit 1; }
[[ "$release_id" =~ ^[A-Za-z0-9._-]{4,80}$ ]] || { echo "PICOM_RELEASE_ID is required and invalid." >&2; exit 1; }
[[ "$(cat "$secret_dir/environment" 2>/dev/null)" == staging ]] || { echo "Staging environment marker is missing." >&2; exit 1; }
for file in "$secret_dir/livekit.yaml" "$secret_dir/redis.conf"; do
  [[ "$(stat -c '%U:%G:%a' "$file")" == root:picom-livekit:640 ]] || { echo "Secret file ownership/mode is invalid." >&2; exit 1; }
done
ufw status verbose | grep -q '^Status: active' || { echo "Default-deny staging firewall must be active before host-network deployment." >&2; exit 1; }
ufw status verbose | grep -Eq '^Default: deny \(incoming\)' || { echo "UFW incoming default must be deny." >&2; exit 1; }

release_dir="/opt/picom-livekit/releases/$release_id"
[[ ! -e "$release_dir" ]] || { echo "Release directory already exists." >&2; exit 1; }
install -o picom-deploy -g picom-livekit -m 0750 -d "$release_dir"
install -o root -g picom-livekit -m 0640 "$source_compose" "$release_dir/compose.yaml"
gid="$(getent group picom-livekit | cut -d: -f3)"
printf 'PICOM_LIVEKIT_GID=%s\nPICOM_LIVEKIT_SECRET_DIR=%s\n' "$gid" "$secret_dir" >"$release_dir/runtime.env"
chown root:picom-livekit "$release_dir/runtime.env"
chmod 0640 "$release_dir/runtime.env"

docker compose --project-name picom-livekit --env-file "$release_dir/runtime.env" -f "$release_dir/compose.yaml" config --quiet
docker compose --project-name picom-livekit --env-file "$release_dir/runtime.env" -f "$release_dir/compose.yaml" pull
docker compose --project-name picom-livekit --env-file "$release_dir/runtime.env" -f "$release_dir/compose.yaml" up -d --remove-orphans --wait --wait-timeout 120
PICOM_COMPOSE_FILE="$release_dir/compose.yaml" PICOM_LIVEKIT_SECRET_DIR="$secret_dir" "$repo_root/infra/livekit/compose/status-staging.sh"

previous="$(readlink -f /opt/picom-livekit/current 2>/dev/null || true)"
[[ -z "$previous" ]] || printf '%s\n' "$previous" >/opt/picom-livekit/previous
ln -sfn "$release_dir" /opt/picom-livekit/current
chown -h root:picom-livekit /opt/picom-livekit/current
echo "Staging Compose release became current after health checks. No secret value was printed."
