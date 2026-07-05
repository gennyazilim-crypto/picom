# Electron Packaging Hardening

Task 255 records the current packaging hardening posture for Picom's Electron desktop app.

## Packaging identity

- Product name: `Picom`
- App identifier: `com.picom.desktop`
- `package.json` remains private to avoid accidental npm publishing.
- Default window size: `1440x900`
- Minimum window size: `1100x700`
- Output directory: `release/`
- Local packages are unsigned by design.

## Electron security posture

- Native application menu is disabled.
- Custom Picom titlebar is used instead of native menu chrome.
- `contextIsolation` is enabled.
- `nodeIntegration` is disabled.
- Renderer sandbox is enabled.
- Insecure mixed content is disabled.
- DevTools are disabled automatically in packaged builds.
- Preload exposes a narrow `window.picomDesktop` bridge instead of raw Electron objects.
- The exposed preload bridge is frozen before it is attached to the renderer global.
- External links are routed through the safe external link service.
- Top-level renderer navigation is blocked and routed through the safe external opener.
- Renderer webview attachment is blocked because Picom does not need embedded remote webviews.

## Platform targets

| Platform | Target | Status |
| --- | --- | --- |
| Windows | NSIS x64 | Configured in `electron-builder.yml` |
| Linux | AppImage x64 | Configured in `electron-builder.yml` |
| Linux | deb x64 | Configured in `electron-builder.yml` |
| macOS | dmg x64 | Placeholder configured |
| macOS | zip x64 | Placeholder configured |

## Icon and metadata checks

- Windows icon: `assets/brand/app-icon.ico`
- Linux icon directory: `assets/brand/icons/`
- Shared source icons: `assets/brand/app-icon.png` and `assets/brand/app-icon.svg`
- macOS uses the current placeholder icon source until a final `.icns` release asset is generated.
- No Discord branding, logo, assets, or copied colors are used.

## Signing placeholders

- Windows signing is intentionally disabled for local builds.
- macOS signing and notarization are intentionally disabled for local builds.
- Signing certificates, passwords, private keys, and notarization credentials must be supplied only through secure CI or a local secret manager later.
- `npm run package:verify` fails if active signing or notarization secret fields are added to the committed packaging config.

## Smoke-test references

- Windows smoke test: `docs/windows-smoke-test.md`
- Linux smoke test: `docs/linux-smoke-test.md`
- macOS smoke test: `docs/macos-smoke-test.md`

## Local verification command

Run the lightweight packaging config check before platform packaging smoke tests:

```bash
npm run package:verify
```

This command validates the expected Picom package identity, platform targets, window sizing, Electron security posture, ASCII-safe packaging metadata, ignored build/package output directories, required icon asset paths, and platform smoke-test documentation without building installers.

## Known local limitation

On the current Windows workstation, `electron-builder --dir` can fail at the temporary unpacked folder rename step with `EPERM`. The build and config still complete before the local filesystem lock. See `docs/electron-packaging.md` for the exact recovery steps.
