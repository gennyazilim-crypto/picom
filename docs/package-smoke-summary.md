# Cross-Platform Package Smoke Summary

This summary tracks the package smoke expectations for Picom's Electron MVP across Windows, Linux, and macOS.

## Current package configuration

- Product name: Picom.
- App id: `com.picom.desktop`.
- Default window size: `1440x900`.
- Minimum window size: `1100x700`.
- Native Electron menu: disabled.
- Custom titlebar: enabled.
- Renderer security: `contextIsolation: true`, `nodeIntegration: false`.
- Preload bridge: required for window, desktop, and screen-share APIs.
- Build output: `release/`.

## Package scripts

```text
npm run package:verify
npm run package:win:dir
npm run package:win
npm run package:linux
npm run package:linux:appimage
npm run package:linux:deb
npm run package:mac
npm run package:mac:dmg
npm run package:mac:zip
```

## Current host expectation

Run package builds on the matching OS whenever possible:

- Windows host: run Windows unpacked/installer smoke.
- Linux host: run Linux AppImage/deb smoke.
- macOS host: run macOS dmg/zip smoke.

Do not mark Linux or macOS package smoke as passed from a Windows-only run.

## Shared smoke expectations

- App launches without startup crash.
- No native File/Edit/View menu is visible.
- No duplicate titlebar appears.
- Window controls work through the safe preload bridge.
- Normal window mode keeps the premium floating frame.
- Maximized mode fills the window without outer margin/radius.
- 4-column community layout renders.
- Mention Feed renders.
- Mock mode works without Supabase secrets.
- No mobile UI appears.
- No Discord branding, logo, copied assets, or exact Discord colors are present.

## Release readiness status

- Local structural package verification is required before every beta build.
- Platform package smoke must be completed on each target platform before release.
- Code signing, notarization, and installer reputation are release-hardening items, not local MVP package-smoke pass criteria.
