#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
versions_file="${1:-}"
[[ "${EUID}" -eq 0 ]] || { echo "Run as root on the dedicated staging host." >&2; exit 1; }
[[ "${PICOM_HOST_PREPARE_CONFIRM:-}" == "STAGING_ONLY" ]] || { echo "Set PICOM_HOST_PREPARE_CONFIRM=STAGING_ONLY." >&2; exit 1; }
[[ -f "$versions_file" ]] || { echo "Provide a protected host-local versions file." >&2; exit 1; }
# shellcheck disable=SC1090
source "$versions_file"
source /etc/os-release
[[ "$ID" == "${PICOM_TARGET_OS_ID:-}" && "$VERSION_ID" == "${PICOM_TARGET_OS_VERSION:-}" && "$(uname -m)" == "${PICOM_TARGET_ARCH:-}" ]] || { echo "Host OS/version/architecture does not match the approved inventory." >&2; exit 1; }

required_versions=(PICOM_DOCKER_CE_VERSION PICOM_DOCKER_CE_CLI_VERSION PICOM_CONTAINERD_VERSION PICOM_BUILDX_VERSION PICOM_COMPOSE_VERSION)
for name in "${required_versions[@]}"; do
  value="${!name:-}"
  [[ -n "$value" && "$value" != REPLACE_* && "$value" =~ ^[A-Za-z0-9.+:~_-]+$ ]] || { echo "$name must contain an approved apt package version." >&2; exit 1; }
done
[[ "${PICOM_BACKUP_DESTINATION:-}" == /mnt/* || "${PICOM_BACKUP_DESTINATION:-}" == /srv/backups/* ]] || { echo "Backup destination must be an approved /mnt or /srv/backups path." >&2; exit 1; }

snapshot="/var/backups/picom-livekit-host/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$snapshot"
chmod 700 "$snapshot"
backup_file() { [[ ! -e "$1" ]] || cp -a --parents "$1" "$snapshot"; }
for path in /etc/docker/daemon.json /etc/apt/apt.conf.d/52picom-security /etc/ssh/sshd_config.d/99-picom-livekit.conf /etc/logrotate.d/picom-livekit /etc/ufw/user.rules /etc/ufw/user6.rules; do backup_file "$path"; done
printf '%s\n' "$snapshot" >/var/backups/picom-livekit-host/LATEST
chmod 600 /var/backups/picom-livekit-host/LATEST

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg jq ufw chrony unattended-upgrades logrotate iperf3
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod 0644 /etc/apt/keyrings/docker.asc
cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-noble}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y \
  "docker-ce=${PICOM_DOCKER_CE_VERSION}" \
  "docker-ce-cli=${PICOM_DOCKER_CE_CLI_VERSION}" \
  "containerd.io=${PICOM_CONTAINERD_VERSION}" \
  "docker-buildx-plugin=${PICOM_BUILDX_VERSION}" \
  "docker-compose-plugin=${PICOM_COMPOSE_VERSION}"
apt-mark hold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

getent group picom-livekit >/dev/null || groupadd --system picom-livekit
id picom-livekit >/dev/null 2>&1 || useradd --system --gid picom-livekit --home-dir /var/lib/picom-livekit --shell /usr/sbin/nologin picom-livekit
id picom-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash picom-deploy
usermod --append --groups picom-livekit picom-deploy
# Deliberately do not add picom-deploy to the root-equivalent docker group.

install -o picom-deploy -g picom-livekit -m 0750 -d /opt/picom-livekit /opt/picom-livekit/releases /opt/picom-livekit/shared
install -o root -g picom-livekit -m 0750 -d /etc/picom-livekit /etc/picom-livekit/secrets
install -o picom-livekit -g picom-livekit -m 0750 -d /var/lib/picom-livekit /var/log/picom-livekit "$PICOM_BACKUP_DESTINATION"
find /etc/picom-livekit/secrets -type f -exec chown root:picom-livekit {} + -exec chmod 0640 {} +

install -o root -g root -m 0644 "$repo_root/infra/livekit/host/52picom-security" /etc/apt/apt.conf.d/52picom-security
install -o root -g root -m 0644 "$repo_root/infra/livekit/host/picom-livekit-logrotate" /etc/logrotate.d/picom-livekit
install -o root -g root -m 0755 "$repo_root/infra/livekit/host/picom-livekit-host-health.sh" /usr/local/sbin/picom-livekit-host-health
install -o root -g root -m 0644 "$repo_root/infra/livekit/host/picom-livekit-host-health.service" /etc/systemd/system/picom-livekit-host-health.service
install -o root -g root -m 0644 "$repo_root/infra/livekit/host/picom-livekit-host-health.timer" /etc/systemd/system/picom-livekit-host-health.timer

install -d -m 0755 /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "live-restore": true,
  "log-driver": "local",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "no-new-privileges": true
}
EOF

if [[ "${PICOM_APPLY_SSH_HARDENING:-}" == "I_HAVE_VERIFIED_KEY_LOGIN" ]]; then
  [[ -f "${PICOM_OPERATOR_AUTHORIZED_KEY_FILE:-}" ]] || { echo "Provide PICOM_OPERATOR_AUTHORIZED_KEY_FILE." >&2; exit 1; }
  grep -Eq '^(ssh-ed25519|sk-ssh-ed25519@openssh.com|ssh-rsa) ' "$PICOM_OPERATOR_AUTHORIZED_KEY_FILE" || { echo "Operator public key format is invalid." >&2; exit 1; }
  install -o picom-deploy -g picom-deploy -m 0700 -d /home/picom-deploy/.ssh
  install -o picom-deploy -g picom-deploy -m 0600 "$PICOM_OPERATOR_AUTHORIZED_KEY_FILE" /home/picom-deploy/.ssh/authorized_keys
  install -o root -g root -m 0644 "$repo_root/infra/livekit/host/99-picom-livekit-sshd.conf" /etc/ssh/sshd_config.d/99-picom-livekit.conf
  sshd -t
  systemctl reload ssh
else
  echo "SSH password hardening not applied; key-login confirmation is required."
fi

if [[ "${PICOM_APPLY_FIREWALL:-}" == "I_HAVE_CONSOLE_ACCESS" ]]; then
  [[ "${PICOM_ADMIN_SSH_CIDR:-}" =~ ^[0-9a-fA-F:./]+$ ]] || { echo "PICOM_ADMIN_SSH_CIDR is required." >&2; exit 1; }
  [[ "${PICOM_SSH_PORT:-22}" =~ ^[0-9]+$ ]] || { echo "PICOM_SSH_PORT is invalid." >&2; exit 1; }
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow from "$PICOM_ADMIN_SSH_CIDR" to any port "${PICOM_SSH_PORT:-22}" proto tcp comment 'Picom operator SSH only'
  ufw --force enable
else
  echo "Firewall not enabled; console-access confirmation is required. No LiveKit port was opened."
fi

systemctl daemon-reload
systemctl enable --now docker chrony unattended-upgrades picom-livekit-host-health.timer
docker version >/dev/null
docker compose version >/dev/null
if ss -H -lntu | awk '{print $5}' | grep -Eq ':(80|443|3478|5349|7880|7881|7882)$'; then echo "A LiveKit candidate port is unexpectedly open before Task 662." >&2; exit 1; fi
echo "Picom LiveKit staging host baseline prepared. Snapshot: $snapshot"
