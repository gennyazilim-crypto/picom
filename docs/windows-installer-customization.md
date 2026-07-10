# Windows Installer Wizard Customization

Picom uses electron-builder with an NSIS assisted installer (`oneClick: false`). This gives users an explicit setup wizard and install-directory choice instead of a silent/one-click install.

## Branding

- Product: Picom.
- App ID: `com.picom.desktop`.
- Installer/uninstaller icon: `assets/brand/app-icon.ico`.
- Header bitmap: `assets/installer/windows/installer-header.bmp` (150 x 57).
- Welcome/finish/uninstall sidebar: `assets/installer/windows/installer-sidebar.bmp` (164 x 314).
- Original teal/mint Picom artwork; no copied assets.

## Safe behavior

- Per-user install (`perMachine: false`).
- Elevation is disabled; setup does not require administrator access.
- User may select install directory.
- Desktop and Start Menu shortcuts are enabled.
- The finish page may offer to launch Picom.
- Uninstall does not delete Picom user data/settings (`deleteAppDataOnUninstall: false`).

## Unsigned local builds

Local candidates may show Windows reputation warnings. Do not instruct users to disable Windows security. Production signing belongs in protected CI/hardware-backed signing and uses no repository certificate/password.

## License page

`docs/legal/installer-license.md` is currently a legal-review placeholder and is intentionally not injected as final installer terms. After legal approval, convert the reviewed text to an NSIS-supported license file and configure it through the reviewed electron-builder license resource.

## Build and smoke

```powershell
npm run build
npm run package:win
```

If repository-local Electron extraction hits `EPERM`, use a unique `%LOCALAPPDATA%\Temp` output with electron-builder. Validate install, launch, shortcuts, finish-page launch, uninstall, reinstall, and user-data preservation on a clean Windows test machine.
