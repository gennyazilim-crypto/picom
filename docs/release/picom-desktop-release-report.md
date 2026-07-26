# PICOM Desktop Release Report — 0.1.1-beta.9

**Date:** 2026-07-26  
**Commit (repo HEAD at publish):** `f655ae868aa1db103df5234a5e1e0e0558d214e8`  
**Branch:** `feat/community-rebuild` (dirty working tree; installer binary was pre-built)

## Artifact

| Field | Value |
| --- | --- |
| File | `Picom-0.1.1-beta.9-beta-Windows-x64.exe` |
| Size | 123,315,761 bytes |
| SHA-256 | `6c7cfcc1fc38f8f208a666bb4dac4a78d8bf8ef13a50120f7cca9c90d07362ff` |
| Signed | **No** (`Get-AuthenticodeSignature` → NotSigned) |
| Channel | beta |
| Arch | Windows x64 |

## Publish actions completed

1. Verified local and server installer SHA-256 match.
2. Backed up site + downloads on server.
3. Created immutable dir `/var/www/picom.gg/downloads/windows/0.1.1-beta.9/`.
4. Switched `latest` symlink `0.1.1-beta.6` → `0.1.1-beta.9`.
5. Promoted `latest.yml` to 0.1.1-beta.9 (aligned with `beta.yml`).
6. Wrote `latest.json` + `/downloads/releases.json`.
7. Patched **661** marketing HTML files (header CTA + download pages) from beta.8 → beta.9.
8. `nginx -t` PASS; `systemctl reload nginx` PASS.
9. Live HTTPS download + full-file SHA-256 match PASS.

## Not done in this run

- Fresh `npm run package:win` rebuild of the dirty tree (existing verified beta.9 binary reused).
- Marketing Astro source rebuild (source not in this monorepo; live HTML patched).
- Interactive Windows installer smoke (open/install UI).
- Code signing (no certificate in environment).
- macOS / Linux installer publication (`available: false`).
