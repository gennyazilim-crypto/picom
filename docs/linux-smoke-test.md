# Linux Package Smoke Test

Picom supports Linux desktop packaging for the MVP Electron shell. This document defines the Linux smoke path without claiming success from a non-Linux host.

## Prerequisites

- Linux desktop environment with AppImage support, or a Debian-based environment for `.deb`.
- Node dependencies installed with `npm install`.
- No production secrets in `.env`.
- Build artifacts are generated under `release/`, which is ignored by git.

## Build commands

```bash
npm run typecheck
npm run mock:smoke
npm run build
npm run package:verify
npm run package:linux
```

Target-specific commands:

```bash
npm run package:linux:appimage
npm run package:linux:deb
```

## Configuration checks

- Linux target includes `AppImage`.
- Linux target includes `deb`.
- Linux executable name is `Picom`.
- Linux category is `Network`.
- Linux icon directory is `assets/brand/icons`.
- Desktop entry uses Picom identity.
- Native File/Edit/View menu remains disabled.
- Custom titlebar is used.
- `contextIsolation` is enabled.
- `nodeIntegration` is disabled.

## Runtime smoke checklist

- Launch AppImage from a terminal and then through desktop integration if enabled.
- Install deb on a disposable host; launch from terminal and the desktop application menu.
- Confirm no native File/Edit/View/Window menu is visible.
- Confirm the custom Picom titlebar is visible.
- Confirm window controls work for the active Linux window manager where supported.
- Confirm titlebar drag area works.
- Confirm search and theme buttons remain clickable.
- Confirm normal window mode keeps the rounded premium frame.
- Confirm maximized mode removes outer padding/radius.
- Confirm the app background is fully painted and not leaking black/purple bands.
- Confirm the 4-column layout renders without horizontal overflow.
- Confirm Home/Mention Feed still opens.
- Confirm community/channel switching works.
- Confirm mock message sending works.
- Confirm light/dark theme toggles.
- Confirm no mobile UI appears.
- Confirm the Picom desktop entry, Network category, and icon are correct.
- Run microphone and screen-share tests under each approved X11/Wayland session.
- Quit and confirm no audio/screen capture remains.

## Install and uninstall

- Inspect deb metadata/contents before installation.
- Verify clean install and prior-beta upgrade.
- Identify the real package name, uninstall through the distro package manager, and verify desktop entry/binaries are removed.
- Confirm unrelated user files are untouched and record retained Picom user data/cache.
- Reinstall the prior approved artifact to prove manual rollback.
- AppImage removal must delete only the artifact and explicit user-created integration entry.

## Supabase mode notes

- The package should start without Supabase env values.
- With Supabase env values, auth/session restore should fail gracefully if the backend is unavailable.

## Pass criteria

- AppImage or deb launches on Linux.
- MVP mock UI remains usable.
- No native menu or duplicate titlebar appears.
- No desktop shell crash occurs.

## Known limitations

- Linux tray, notification, microphone, and screen-share behavior can vary by desktop environment.
- Package signing is not covered by this local smoke test.
- rpm packaging is not configured in the current Electron builder config.
- arm64, repository publishing/signing, AppStream metadata, and a final supported distro matrix are not configured.
