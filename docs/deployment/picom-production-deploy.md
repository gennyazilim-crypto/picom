# PICOM Production Deploy — Desktop Release 0.1.1-beta.9

## Server

| Item | Value |
| --- | --- |
| Host alias | `picom-update-server` → `23.254.166.240` |
| User | `root` |
| OS | Ubuntu 24.04 |
| Web root | `/var/www/picom.gg` |
| Downloads | `/var/www/picom.gg/downloads/windows/` |

## Procedure used

1. SSH connectivity check (`hostname`, `uptime`, `df`, `nginx -t`).
2. Backup: `/var/backups/picom/web/picom.gg-download-publish-20260726-203925.tar.gz`
3. Staging under `/var/www/.deploy/` then promote immutable version dir.
4. Atomic `latest` symlink switch to `0.1.1-beta.9`.
5. Publish `latest.yml`, `latest.json`, `/downloads/releases.json`.
6. Patch marketing HTML download links.
7. `nginx -t` → `systemctl reload nginx`.
8. Live curl smoke + full installer SHA-256 verify.

## Script

`scripts/publish-desktop-release-0.1.1-beta.9.sh` (ran on server).

## Domains verified after deploy

- https://picom.gg → 200
- https://app.picom.gg → 200
- https://account.picom.gg → 200
- https://support.picom.gg → 301 → https://account.picom.gg/support
- Installer HEAD/GET → 200 + checksum match
