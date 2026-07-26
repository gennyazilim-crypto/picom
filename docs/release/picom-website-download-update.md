# PICOM Website Download Update — 0.1.1-beta.9

## Scope

Marketing site at `/var/www/picom.gg` (Astro static export). Source is **not** in this monorepo (`sites/web/` only hosts auth bridges).

## Changes on production

- Replaced installer hrefs and displayed version strings from `0.1.1-beta.8` → `0.1.1-beta.9` in **661** HTML files under `/var/www/picom.gg`.
- Primary CTA patterns:
  - Header / hero download buttons
  - `/download/` and locale variants (`/tr/download/`, etc.)
- Residual old `.exe` hrefs after patch: **0**

## Canonical download URL after update

```text
https://picom.gg/downloads/windows/latest/Picom-0.1.1-beta.9-beta-Windows-x64.exe
```

## Warning

The next Astro marketing deploy from an external repo will overwrite these HTML files unless that source is updated to beta.9 (or reads `releases.json`).
