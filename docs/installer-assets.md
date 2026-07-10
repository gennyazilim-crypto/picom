# Installer Asset Inventory

## Release-used assets

| Platform | Asset | Format and size | Current use |
| --- | --- | --- | --- |
| Shared | `assets/brand/app-icon.png` | PNG, 1024x1024 | macOS and source icon |
| Windows | `assets/brand/app-icon.ico` | ICO | app, installer, uninstaller |
| Windows | `assets/installer/windows/installer-header.bmp` | BMP, 150x57 | NSIS header |
| Windows | `assets/installer/windows/installer-sidebar.bmp` | BMP, 164x314 | NSIS install/uninstall sidebar |
| macOS | `assets/installer/macos/dmg-background.png` | PNG, 660x400 | DMG Finder background |
| Linux | `assets/brand/icons` | generated PNG icon set | AppImage/DEB desktop icon |

All release-used artwork is original Picom branding. No Discord logo, copied
asset, or unlicensed third-party artwork is included in this inventory.

## Intentional placeholders

- `assets/installer/shared/picom-installer-mark.placeholder.svg`
- `assets/installer/shared/picom-wordmark.placeholder.svg`

These files describe future shared installer source direction. They are not
referenced by packaging and must not be promoted without visual and rights
review. Their `.placeholder.` filename is a release-safety signal.

## Replacement rules

1. Preserve aspect ratio and required target dimensions.
2. Use an original Picom source with documented ownership.
3. Do not embed text that will conflict with translated installer copy.
4. Update this inventory and the platform README.
5. Run `npm run installer:branding:smoke` and `npm run package:verify`.
6. Inspect the actual package on the target operating system before release.

## Platform QA boundary

Asset dimensions and packaging references can be checked on Windows. Pixel-level
installer rendering, DPI scaling, Finder layout, Linux desktop icon resolution,
and accessibility still require native target-host review.
