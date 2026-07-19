# Picom Installer License Notice

Installer acceptance is wired to the public documents on **picom.gg**:

- Terms of Service: https://picom.gg/terms
- Security & Privacy: https://picom.gg/security
- Privacy Policy: https://picom.gg/privacy

## Installer integration status

Windows NSIS (`electron-builder.yml` → `nsis.license`) presents
`assets/installer/windows/license.html` (plus `license_en.html` /
`license_tr.html`) with the standard MUI **I Agree** checkbox before install
continues.

- Preserve `THIRD_PARTY_NOTICES.md`, including Coolicons attribution.
- Do not add proprietary or third-party assets without documented rights.
- Product/legal owners should keep picom.gg terms/security pages current; the
  installer links to those URLs rather than embedding full legal text.

The legal draft set remains indexed in
`docs/legal/installer-legal-documents.md` for engineering reference.
