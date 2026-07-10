# Linux Package Branding

## Scope

Picom currently prepares native Linux packages for AppImage and DEB. RPM is a
documented future target and is not produced by the current configuration.

## Package identity

- Product name: Picom
- Executable name: `Picom`
- Desktop comment: Desktop community workspace
- Categories: `Network;Chat;Utility;`
- Terminal application: no
- Startup window class: `Picom`
- Maintainer: Picom Contributors

The desktop entry is generated from `electron-builder.yml`. Package icons are
loaded from `assets/brand/icons`; installer-specific Linux assets belong under
`assets/installer/linux` if a target later requires them.

## Build commands

Run these commands on a supported Linux build host:

```bash
npm ci
npm run build
npm run package:linux
```

Do not publish artifacts from an unreviewed local build. Validate the generated
desktop entry, application menu icon, executable launch, file ownership, and
uninstall behavior before promotion.

## Desktop-entry QA

Inspect the generated `.desktop` file and verify:

- `Name=Picom`
- `Comment=Desktop community workspace`
- `Categories=Network;Chat;Utility;`
- `Terminal=false`
- the icon resolves at common desktop sizes
- launching from GNOME/KDE opens a single Picom window

## Known platform boundary

Windows can validate configuration and compile the application, but a native
Linux host or trusted Linux CI runner is required for final AppImage/DEB launch,
menu integration, dependency, and uninstall checks.
