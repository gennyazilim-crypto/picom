#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
secret_dir="${PICOM_LIVEKIT_SECRET_DIR:-/etc/picom-livekit/secrets}"
[[ "${EUID}" -eq 0 ]] || { echo "Run as root on the staging host." >&2; exit 1; }
[[ "${PICOM_SECRET_GENERATE_CONFIRM:-}" == "STAGING_ONLY" ]] || { echo "Set PICOM_SECRET_GENERATE_CONFIRM=STAGING_ONLY." >&2; exit 1; }
getent group picom-livekit >/dev/null || { echo "Task 660 host group is missing." >&2; exit 1; }

livekit_path="$secret_dir/livekit.yaml"
redis_path="$secret_dir/redis.conf"
if [[ -e "$livekit_path" || -e "$redis_path" ]]; then
  [[ "${PICOM_SECRET_ROTATION_CONFIRM:-}" == "ROTATE_STAGING_SECRETS" ]] || { echo "Staging secret files already exist; explicit rotation confirmation is required." >&2; exit 1; }
fi

install -o root -g picom-livekit -m 0750 -d "$secret_dir"
temporary="$(mktemp -d "$secret_dir/.generate.XXXXXX")"
trap 'rm -rf "$temporary"' EXIT
api_key="PIC$(openssl rand -hex 12)"
api_secret="$(openssl rand -hex 32)"
redis_password="$(openssl rand -hex 32)"

sed \
  -e "s/__SIGNAL_PORT__/7880/g" \
  -e "s/__METRICS_PORT__/6789/g" \
  -e "s/__RTC_TCP_PORT__/7881/g" \
  -e "s/__RTC_UDP_START__/50000/g" \
  -e "s/__RTC_UDP_END__/60000/g" \
  -e "s/__REDIS_PORT__/6379/g" \
  -e "s/__REDIS_PASSWORD__/$redis_password/g" \
  -e "s/__LIVEKIT_API_KEY__/$api_key/g" \
  -e "s/__LIVEKIT_API_SECRET__/$api_secret/g" \
  "$repo_root/infra/livekit/compose/livekit.staging.template.yaml" >"$temporary/livekit.yaml"
sed \
  -e "s/__REDIS_PORT__/6379/g" \
  -e "s/__REDIS_PASSWORD__/$redis_password/g" \
  "$repo_root/infra/livekit/compose/redis.staging.template.conf" >"$temporary/redis.conf"

grep -q 'turn:' "$temporary/livekit.yaml"
grep -q 'enabled: false' "$temporary/livekit.yaml"
grep -q '^bind 127.0.0.1' "$temporary/redis.conf"
install -o root -g picom-livekit -m 0640 "$temporary/livekit.yaml" "$livekit_path"
install -o root -g picom-livekit -m 0640 "$temporary/redis.conf" "$redis_path"
printf 'staging\n' | install -o root -g picom-livekit -m 0640 /dev/stdin "$secret_dir/environment"
unset api_key api_secret redis_password
echo "Staging LiveKit/Redis secret files generated without printing values. Task 662 must finalize TURN/TLS before public exposure."
