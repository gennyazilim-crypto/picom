#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

evidence_path="${1:-/var/lib/picom-livekit-host-hardening/prerequisites.json}"
if [[ "${EUID}" -ne 0 ]]; then echo "Run as root on the dedicated staging host." >&2; exit 1; fi
source /etc/os-release
arch="$(uname -m)"
cpu_count="$(nproc)"
memory_kib="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
root_total_kib="$(df -Pk / | awk 'NR==2 {print $2}')"
root_available_kib="$(df -Pk / | awk 'NR==2 {print $4}')"
docker_version="$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
compose_version="$(docker compose version --short 2>/dev/null || true)"
time_synchronized="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || echo false)"

mapfile -t listening_ports < <(ss -H -lntu 2>/dev/null | awk '{endpoint=$5; sub(/^.*:/, "", endpoint); if(endpoint ~ /^[0-9]+$/) print endpoint}' | sort -nu)
livekit_ports_open=false
for port in "${listening_ports[@]:-}"; do
  if [[ "$port" =~ ^(80|443|3478|5349|7880|7881|7882)$ ]] || (( port >= 50000 && port <= 60000 )); then livekit_ports_open=true; fi
done

secret_permissions="missing"
if [[ -d /etc/picom-livekit/secrets ]]; then
  secret_permissions="$(stat -c '%U:%G:%a' /etc/picom-livekit/secrets)"
fi

throughput_status="blocked_missing_controlled_iperf3_target"
throughput_bps=null
if [[ -n "${PICOM_IPERF3_TARGET:-}" && "${PICOM_NETWORK_TEST_CONFIRM:-}" == "STAGING_ONLY" ]]; then
  command -v iperf3 >/dev/null || { echo "iperf3 is required for the approved controlled target." >&2; exit 1; }
  result="$(iperf3 --json --client "$PICOM_IPERF3_TARGET" --time 10 --omit 2)"
  throughput_bps="$(jq -r '.end.sum_received.bits_per_second // .end.sum_sent.bits_per_second // empty' <<<"$result")"
  [[ "$throughput_bps" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo "Controlled throughput result is invalid." >&2; exit 1; }
  throughput_status="measured_controlled_target"
fi

mkdir -p "$(dirname "$evidence_path")"
jq -n \
  --arg osId "$ID" --arg osVersion "$VERSION_ID" --arg architecture "$arch" \
  --argjson cpuCount "$cpu_count" --argjson memoryKiB "$memory_kib" \
  --argjson rootTotalKiB "$root_total_kib" --argjson rootAvailableKiB "$root_available_kib" \
  --arg dockerVersion "$docker_version" --arg composeVersion "$compose_version" \
  --arg timeSynchronized "$time_synchronized" --arg secretPermissions "$secret_permissions" \
  --arg throughputStatus "$throughput_status" --argjson throughputBps "$throughput_bps" \
  --argjson livekitPortsOpen "$livekit_ports_open" \
  '{schemaVersion:1,environment:"staging",hostnameIncluded:false,ipAddressesIncluded:false,os:{id:$osId,version:$osVersion,architecture:$architecture},resources:{cpuCount:$cpuCount,memoryKiB:$memoryKiB,rootTotalKiB:$rootTotalKiB,rootAvailableKiB:$rootAvailableKiB},runtime:{dockerVersion:$dockerVersion,composeVersion:$composeVersion},security:{timeSynchronized:($timeSynchronized=="true"),secretDirectoryPermissions:$secretPermissions,livekitPortsOpen:$livekitPortsOpen},network:{throughputStatus:$throughputStatus,throughputBps:$throughputBps},secretsIncluded:false}' >"$evidence_path"
chmod 600 "$evidence_path"
if [[ "$ID" != ubuntu || "$VERSION_ID" != 24.04 || "$arch" != x86_64 || "$livekit_ports_open" == true ]]; then exit 1; fi
echo "Picom Linux host prerequisite evidence written without hostnames, addresses, or secrets."
