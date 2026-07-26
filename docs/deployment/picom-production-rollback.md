# PICOM Production Rollback — Desktop Release

## Backup used for this publish

```text
/var/backups/picom/web/picom.gg-download-publish-20260726-203925.tar.gz
```

HTML reference backup may also exist beside the publish script output (see release report timestamp `20260726-203925`).

## Rollback steps (downloads + marketing links)

```bash
ssh picom-update-server

# 1) Restore latest symlink to previous version if needed
cd /var/www/picom.gg/downloads/windows
# Example previous: 0.1.1-beta.8 or 0.1.1-beta.6 — use the pre-publish target
ln -sfn 0.1.1-beta.8 latest.new
mv -Tf latest.new latest

# 2) Restore latest.yml / manifests from backup archive
cd /tmp
tar -tzf /var/backups/picom/web/picom.gg-download-publish-20260726-203925.tar.gz | head
# Extract targeted files into place, then:

nginx -t && systemctl reload nginx

# 3) Verify
curl -I https://picom.gg/downloads/windows/latest.yml
curl -I https://picom.gg/downloads/windows/latest/Picom-0.1.1-beta.8-beta-Windows-x64.exe
```

## Full site restore (if HTML patch must be reverted)

```bash
# Extract backup over /var/www/picom.gg only after confirming archive contents
# Prefer restoring only HTML + downloads metadata, not wiping immutable version dirs
```

## Do not

- Delete immutable `/downloads/windows/0.1.1-beta.9/` unless intentionally retiring that release.
- Reload nginx if `nginx -t` fails.
