#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
compose_file="${PICOM_COMPOSE_FILE:-$repo_root/infra/livekit/compose/compose.yaml}"
secret_dir="${PICOM_LIVEKIT_SECRET_DIR:-/etc/picom-livekit/secrets}"
gid="$(getent group picom-livekit | cut -d: -f3)"
[[ -n "$gid" ]] || { echo "picom-livekit group is missing." >&2; exit 1; }
export PICOM_LIVEKIT_GID="$gid" PICOM_LIVEKIT_SECRET_DIR="$secret_dir"

redis_id="$(docker compose --project-name picom-livekit -f "$compose_file" ps -q redis)"
livekit_id="$(docker compose --project-name picom-livekit -f "$compose_file" ps -q livekit)"
[[ -n "$redis_id" && -n "$livekit_id" ]] || { echo "Staging containers are not running." >&2; exit 1; }
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$redis_id")" == healthy ]] || { echo "Redis is not healthy." >&2; exit 1; }
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$livekit_id")" == healthy ]] || { echo "LiveKit is not healthy." >&2; exit 1; }

docker exec "$redis_id" sh -ec 'REDISCLI_AUTH="$(sed -n "s/^requirepass //p" /run/secrets/redis_config)" redis-cli -h 127.0.0.1 -p "$(sed -n "s/^port //p" /run/secrets/redis_config)" ping | grep -qx PONG'
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:7880/ >/dev/null
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:6789/metrics | grep -q '^# HELP'

error_count="$(docker logs --since 5m "$livekit_id" 2>&1 | grep -Eci '(^|[[:space:]])(error|fatal|panic)([[:space:]]|$)' || true)"
[[ "$error_count" == 0 ]] || { echo "LiveKit emitted error-level logs; inspect through the approved redacted operator path." >&2; exit 1; }
echo "Staging LiveKit and Redis health, loopback API, protected metrics, and recent log-level checks passed."
