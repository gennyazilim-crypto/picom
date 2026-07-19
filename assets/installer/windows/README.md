# Windows installer assets

The assisted NSIS installer uses original Picom bitmap artwork:

- `installer-sidebar.bmp`: 164 x 314 welcome/finish and uninstall sidebar.
- `installer-custom.nsh`: electron-builder NSIS include (no binding license page).

There is **no top header strip** (`installerHeader` is intentionally unset). Branding
lives in the sidebar only.

Regenerate bitmaps from the approved app logo:

```bash
npm run installer:windows:art
```

Requires Pillow (`pip install pillow`). Languages: `en_US` + `tr_TR` with
`displayLanguageSelector` in `electron-builder.yml`. Review copy in
`docs/installer/bilingual-copy.md`.

Do not use copied third-party artwork.
