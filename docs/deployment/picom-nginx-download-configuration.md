# PICOM Nginx Download Configuration

## Observed production model

Static site root: `/var/www/picom.gg`  
Downloads served as static files under `/downloads/windows/`.

No new `download.picom.gg` vhost was required or created.

## Behavior verified

- Installer URLs return HTTP 200 over HTTPS.
- `Content-Length` present for the Windows exe.
- `nginx -t` PASS after publish; reload PASS.

## Recommended (optional) hardening — only if not already present

```nginx
location ~* \.(exe|msi|dmg|pkg|AppImage|deb|rpm|zip)$ {
    try_files $uri =404;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Content-Disposition "attachment" always;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location = /downloads/releases.json {
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
}

location ~* /(latest|beta)\.yml$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
}
```

Do not apply blanket `Content-Disposition: attachment` to all of `/downloads/` if JSON/YAML must open inline.

## Cache note

Versioned binaries may use long cache. Manifests and `latest.yml` / `beta.yml` should stay short-cache or no-cache so clients see new releases promptly.
