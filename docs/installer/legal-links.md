# Installer legal & site links

Canonical public URLs from **picom.gg**. Used by the live installer preview
(`live-preview.html`) and NSIS finish-page wiring.

| Item | English label | Türkçe | URL | Status |
| --- | --- | --- | --- | --- |
| Website | Website | Web sitesi | https://picom.gg | Live |
| User agreement | User agreement | Kullanıcı sözleşmesi | https://picom.gg/terms | Live |
| Security & privacy | Security & privacy | Güvenlik ve gizlilik | https://picom.gg/security | Live |
| Privacy Policy (related) | Privacy | Gizlilik | https://picom.gg/privacy | Live |

## Rules

- Preview shows these as accordion links in the right rail, plus an **acceptance
  checkbox** that must be checked before Continue on the License step.
- Windows NSIS presents `assets/installer/windows/license*.html` with the MUI
  **I Agree** checkbox (`nsis.license` in `electron-builder.yml`).
- Keep `legal-links.json` and license HTML URLs in sync with https://picom.gg.
