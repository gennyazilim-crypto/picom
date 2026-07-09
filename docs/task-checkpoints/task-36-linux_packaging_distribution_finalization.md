# Task 36 Checkpoint: Linux Packaging and Distribution Finalization

## Scope

- Added native Linux AppImage/deb build, artifact inspection, terminal/menu launch, install/upgrade/uninstall/reinstall, dependency, and media-session guidance.
- Added package-format/distribution policy and explicit metadata gaps.
- Extended the existing Linux smoke checklist.

## Verified configuration

- AppImage x64 and deb x64 are configured.
- Picom executable, Network category, maintainer, description, deb `net` metadata, and multi-size icons are present.
- rpm, arm64, repository publishing, and package signing are not configured or claimed.
- No signing key was added.

## Validation

- `npm run packaging:smoke` - passed configuration checks.
- `npm run electron:security:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed on Windows with the known non-blocking chunk warning.
- Native Linux AppImage/deb build and smoke - not run; Linux host required.

## External work remaining

- Build and test AppImage/deb on native Linux hosts.
- Approve distro/glibc/desktop environment and X11/Wayland support matrix.
- Run microphone, screen-share, tray, notification, install/uninstall, and protocol smoke natively.
