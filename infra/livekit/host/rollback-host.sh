#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "${EUID}" -eq 0 ]] || { echo "Run as root from console/recovery access." >&2; exit 1; }
[[ "${PICOM_HOST_ROLLBACK_CONFIRM:-}" == "ROLLBACK_HOST_BASELINE" ]] || { echo "Set PICOM_HOST_ROLLBACK_CONFIRM=ROLLBACK_HOST_BASELINE." >&2; exit 1; }
snapshot="${1:-}"
[[ -d "$snapshot" && "$snapshot" == /var/backups/picom-livekit-host/* ]] || { echo "Provide an approved Picom host snapshot directory." >&2; exit 1; }

restore_or_remove() {
  target="$1"
  saved="$snapshot$target"
  if [[ -e "$saved" ]]; then cp -a "$saved" "$target"; else rm -f "$target"; fi
}

systemctl disable --now picom-livekit-host-health.timer 2>/dev/null || true
for path in /etc/docker/daemon.json /etc/apt/apt.conf.d/52picom-security /etc/ssh/sshd_config.d/99-picom-livekit.conf /etc/logrotate.d/picom-livekit /etc/ufw/user.rules /etc/ufw/user6.rules; do restore_or_remove "$path"; done
rm -f /etc/systemd/system/picom-livekit-host-health.service /etc/systemd/system/picom-livekit-host-health.timer /usr/local/sbin/picom-livekit-host-health
apt-mark unhold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1 || true
sshd -t
systemctl daemon-reload
systemctl reload ssh
systemctl restart docker
ufw reload 2>/dev/null || true

echo "Managed host baseline files restored. Users, data, backups, Docker packages, images, and volumes were preserved for manual review."
