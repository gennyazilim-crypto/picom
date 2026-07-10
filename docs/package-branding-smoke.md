# Package Branding Smoke

## Commands

- `npm run installer:branding:smoke`
- `npm run first-launch:smoke`
- `npm run package:verify`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Expected package commands

- Windows: `npm run package:win`
- Linux AppImage: `npm run package:linux:appimage`
- Linux deb: `npm run package:linux:deb`
- macOS DMG/zip: `npm run package:mac:signed-candidate` on approved macOS CI

Windows packaging uses a unique temp output when repository-local Electron extraction is locked by Windows `EPERM`. Linux and macOS certification must run on native hosts. No package success is inferred from configuration-only smoke tests.

## Brand criteria

- Product and executable are Picom.
- App ID remains `com.picom.desktop`.
- Installer/package icons resolve from approved Picom assets.
- Placeholder assets are explicitly named and never presented as final artwork.
- No Discord branding, logo, copied assets, or exact colors.
