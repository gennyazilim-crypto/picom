# Windows Packaging Smoke Test

Task 254 hardens the Windows packaging verification path for Picom.

## Preconditions

- Run on Windows 10/11.
- Install dependencies with `npm install`.
- Close running Picom/Electron instances before packaging.

## Commands

```bash
npm run build
npm run package:win:dir
npm run package:win
```

## Checks

- Product name is `Picom`.
- App ID is `com.picom.desktop`.
- Package target is NSIS x64.
- Local build is unsigned.
- No native File/Edit/View menu is visible.
- Custom Picom titlebar is visible.
- Default window size is 1440 x 900.
- Minimum window size is 1100 x 700.
- Window controls work.
- The app icon uses `assets/brand/app-icon.ico`.
- The 4-column desktop layout remains stable.

## Known local blocker

If packaging fails with:

```text
EPERM: operation not permitted, rename 'release\\win-unpacked.tmp' -> 'release\\win-unpacked'
```

Close Electron/Picom, delete `release/win-unpacked.tmp`, and retry from an elevated terminal or a folder not blocked by Windows Controlled Folder Access/antivirus.
