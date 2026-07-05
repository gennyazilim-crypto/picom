# Linux Packaging Smoke Test

Task 254 hardens the Linux packaging verification path for Picom.

## Preconditions

- Run on Linux or Linux CI.
- Install dependencies with `npm install`.
- Ensure AppImage/deb build dependencies are available for the runner.

## Commands

```bash
npm run build
npm run package:linux:appimage
npm run package:linux:deb
```

## AppImage checks

- AppImage artifact is created under `release/`.
- Artifact name starts with `Picom-`.
- App launches after `chmod +x Picom-*.AppImage`.
- Custom Picom titlebar is visible.
- No native File/Edit/View menu appears.
- Fixed 4-column desktop layout remains stable.
- Native service fallbacks do not crash when tray/notifications are unavailable.

## deb checks

- `.deb` artifact is created under `release/`.
- Debian package category is `net`.
- Install succeeds with `sudo apt install ./Picom-*.deb` or `sudo dpkg -i Picom-*.deb`.
- Picom launches from the app menu or terminal.
- Uninstall succeeds with `sudo apt remove picom`.

## Icon checks

- Linux packaging uses `assets/brand/icons/`.
- Desktop entry shows the Picom placeholder icon where the desktop environment supports it.
