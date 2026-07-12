# Self-Hosted LiveKit Linux Host Hardening

Status: **BLOCKED_PENDING_REAL_LINUX_HOST_EXECUTION**

This runbook prepares the dedicated Picom staging Linux VM. It does not claim that a host was provisioned from the Windows development machine. Voice Rooms and Screen Share remain active V1 capabilities; this infrastructure status blocks public release certification, not the UI.

## Approved baseline

- Ubuntu Server 24.04 LTS, `x86_64`, dedicated to Picom staging.
- Initial sizing candidate: 4 dedicated vCPU, 8 GiB RAM, 80 GiB SSD, symmetric 1 Gbps candidate pending measurement.
- Separate staging and production hosts, credentials, Redis, DNS, TLS, monitoring, and backups.
- Official Docker apt repository with every Docker/CLI/containerd/buildx/Compose package supplied as an exact approved apt version.
- Root-owned Docker daemon. `picom-deploy` is intentionally not in the root-equivalent `docker` group.
- `picom-livekit` is a non-login service user; secrets are root-owned and group-readable only.

Ubuntu 24.04 is a supported Docker Engine target, but Docker warns that published container ports can bypass UFW. Task 660 therefore publishes no LiveKit container port. Task 662 must install reviewed `DOCKER-USER`/iptables-compatible rules matching the final Compose topology before any exposure.

## Filesystem and identities

| Path/account | Ownership/mode | Purpose |
| --- | --- | --- |
| `picom-deploy` | login operator, no Docker group | prepares reviewed release bundles |
| `picom-livekit` | system user, `nologin` | owns runtime data/logs |
| `/opt/picom-livekit` | `picom-deploy:picom-livekit`, `0750` | versioned deployment bundles |
| `/etc/picom-livekit/secrets` | `root:picom-livekit`, directory `0750`, files `0640` | host-local secret files only |
| `/var/lib/picom-livekit` | `picom-livekit:picom-livekit`, `0750` | runtime state |
| `/var/log/picom-livekit` | `picom-livekit:picom-livekit`, `0750` | bounded logs, no media/tokens |
| approved `/mnt` or `/srv/backups` path | `picom-livekit:picom-livekit`, `0750` | configuration/metadata backup destination |

## Preparation

1. Provision the dedicated Ubuntu VM with console/recovery access and a separate current administrator session.
2. Copy this repository checkout to a protected staging workspace.
3. Copy `infra/livekit/host/versions.env.example` outside the repository and replace every Docker placeholder with an approved version from `apt-cache madison`.
4. Set only non-secret confirmations in the root shell.
5. Run preflight, preparation, and postflight:

```bash
sudo infra/livekit/host/host-prerequisites.sh /root/picom-preflight.json
sudo --preserve-env=PICOM_HOST_PREPARE_CONFIRM,PICOM_APPLY_SSH_HARDENING,PICOM_OPERATOR_AUTHORIZED_KEY_FILE,PICOM_APPLY_FIREWALL,PICOM_ADMIN_SSH_CIDR,PICOM_SSH_PORT \
  infra/livekit/host/prepare-host.sh /root/picom-livekit-versions.env
sudo infra/livekit/host/host-prerequisites.sh /root/picom-postflight.json
```

Required top-level confirmation: `PICOM_HOST_PREPARE_CONFIRM=STAGING_ONLY`.

SSH hardening is applied only with `PICOM_APPLY_SSH_HARDENING=I_HAVE_VERIFIED_KEY_LOGIN` and a valid public-key file. The script installs the key first, validates `sshd -t`, and then reloads SSH. Keep the current session and console open until a second key-based login succeeds.

Firewall activation is applied only with `PICOM_APPLY_FIREWALL=I_HAVE_CONSOLE_ACCESS`, a restricted `PICOM_ADMIN_SSH_CIDR`, and the actual SSH port. It resets UFW to deny inbound and opens only operator SSH. It does not open signal, TLS, TURN, Redis, or media ports.

## Security baseline

- Root SSH login, password login, keyboard-interactive login, forwarding, and empty passwords are disabled only after key-login approval.
- Chrony and system time synchronization are enabled.
- Daily official Ubuntu security updates are enabled through a drop-in; automatic reboot remains disabled for an operator-controlled maintenance window.
- Docker uses local bounded logs, live restore, and default no-new-privileges.
- A five-minute systemd timer checks disk threshold, time synchronization, and Docker availability without logging hostnames, addresses, or secrets.
- Picom logs rotate daily/at 25 MiB, retain 14 compressed rotations, and never include raw media.
- Host prerequisite evidence omits hostname/IP and marks throughput blocked unless a controlled `iperf3` target and `STAGING_ONLY` confirmation are provided.

## Port freeze

Before Task 662, none of the following may be published for Picom: `80`, `443`, `3478`, `5349`, `7880`, `7881`, `7882`, or UDP `50000-60000`. Existing unrelated host services must be reviewed separately; this script does not terminate them.

## Rollback

Every preparation run stores managed-file snapshots under `/var/backups/picom-livekit-host/<UTC timestamp>` and updates a root-only `LATEST` pointer. From console/recovery access:

```bash
export PICOM_HOST_ROLLBACK_CONFIRM=ROLLBACK_HOST_BASELINE
sudo --preserve-env=PICOM_HOST_ROLLBACK_CONFIRM \
  infra/livekit/host/rollback-host.sh /var/backups/picom-livekit-host/<timestamp>
```

Rollback restores only managed configuration and unholds Docker packages. It does not delete users, `/opt` bundles, secret files, backups, images, volumes, containers, or Docker data. Review those manually after service recovery.

## Remaining evidence

- Real OS/architecture/resource inventory: BLOCKED, no Linux host supplied.
- Exact Docker/Compose package versions: BLOCKED, select from the real host repository snapshot.
- SSH second-session key login: BLOCKED.
- Firewall/DOCKER-USER audit: BLOCKED until Task 662 final config.
- Baseline public/symmetric throughput: BLOCKED until a controlled target exists.
- Backup mount durability/restore: BLOCKED until operator and destination are assigned.

Official references: Docker Engine Ubuntu installation and firewall caveat, Ubuntu automatic security updates, Ubuntu OpenSSH key guidance.
