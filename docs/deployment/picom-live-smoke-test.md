# PICOM Live Smoke Test — 2026-07-26

## HTTPS status

| URL | Result |
| --- | --- |
| https://picom.gg | PASS (200) |
| https://picom.gg/download/ | PASS (download page reachable; CTAs point at beta.9) |
| https://app.picom.gg | PASS (200) |
| https://account.picom.gg | PASS (200) |
| https://support.picom.gg | PASS (301 → https://account.picom.gg/support) |

## Download

| Check | Result |
| --- | --- |
| HEAD latest installer | PASS (200, Content-Length 123315761) |
| Full download SHA-256 | PASS (`6c7cfcc1fc38f8f208a666bb4dac4a78d8bf8ef13a50120f7cca9c90d07362ff`) |
| Matches local release | PASS |
| Matches server file | PASS |
| Residual beta.8 exe hrefs | PASS (0 remaining after HTML patch) |

## Not run

| Check | Status |
| --- | --- |
| Interactive Windows installer UI smoke | BLOCKED |
| Playwright E2E browser click → download | NOT RUN (CLI curl used) |
| Electron auto-update old→new client path | NOT RUN |

## Commands used

```bash
curl -I https://picom.gg
curl -I https://app.picom.gg
curl -I https://account.picom.gg
curl -I https://support.picom.gg
curl -I https://picom.gg/downloads/windows/latest/Picom-0.1.1-beta.9-beta-Windows-x64.exe
curl -L -o /tmp/picom-live.exe https://picom.gg/downloads/windows/latest/Picom-0.1.1-beta.9-beta-Windows-x64.exe
sha256sum /tmp/picom-live.exe
```
