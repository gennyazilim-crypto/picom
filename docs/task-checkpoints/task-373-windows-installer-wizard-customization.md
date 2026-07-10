# Task 373 checkpoint: Windows installer wizard customization

## Implemented

- Confirmed electron-builder + assisted NSIS.
- Added original Picom header/sidebar BMPs with required dimensions.
- Configured per-user, no-elevation setup with install-directory selection.
- Preserved desktop/Start shortcuts, optional finish launch, and user data on uninstall.
- Kept signing material outside the repository.

## Validation

- `npm run installer:branding:smoke`
- `npm run package:verify`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- Windows NSIS package command using unique temp output when required.
