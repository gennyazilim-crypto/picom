#!/usr/bin/env bash
set -Eeuo pipefail

threshold="${PICOM_DISK_ALERT_PERCENT:-75}"
if [[ ! "$threshold" =~ ^[0-9]+$ ]] || (( threshold < 50 || threshold > 95 )); then
  logger -p authpriv.warning -t picom-livekit-host-health "invalid disk threshold"
  exit 2
fi

used="$(df -P /opt/picom-livekit | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
status=0
if (( used >= threshold )); then
  logger -p authpriv.warning -t picom-livekit-host-health "deployment filesystem crossed configured disk threshold"
  status=1
fi
if ! timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -qx true; then
  logger -p authpriv.warning -t picom-livekit-host-health "time synchronization is not confirmed"
  status=1
fi
if ! systemctl is-active --quiet docker; then
  logger -p authpriv.warning -t picom-livekit-host-health "docker service is inactive"
  status=1
fi
exit "$status"
