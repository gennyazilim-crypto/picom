#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
target="${1:-$(cat /opt/picom-livekit/previous 2>/dev/null || true)}"
[[ "${EUID}" -eq 0 ]] || { echo "Run as root through the approved deployment path." >&2; exit 1; }
[[ "${PICOM_ROLLBACK_CONFIRM:-}" == "ROLLBACK_STAGING" ]] || { echo "Set PICOM_ROLLBACK_CONFIRM=ROLLBACK_STAGING." >&2; exit 1; }
[[ "$target" == /opt/picom-livekit/releases/* && -f "$target/compose.yaml" && -f "$target/runtime.env" ]] || { echo "Approved rollback release is invalid." >&2; exit 1; }

docker compose --project-name picom-livekit --env-file "$target/runtime.env" -f "$target/compose.yaml" config --quiet
docker compose --project-name picom-livekit --env-file "$target/runtime.env" -f "$target/compose.yaml" up -d --remove-orphans --wait --wait-timeout 120
PICOM_COMPOSE_FILE="$target/compose.yaml" "$repo_root/infra/livekit/compose/status-staging.sh"
ln -sfn "$target" /opt/picom-livekit/current
chown -h root:picom-livekit /opt/picom-livekit/current
echo "Staging Compose rollback passed health checks. Secret files and Redis data were preserved."
