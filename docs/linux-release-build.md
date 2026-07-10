# Picom Linux Release Build

## Current targets

- Architecture: x64.
- AppImage: portable artifact.
- deb: Debian-family installer.
- rpm: not configured.
- Distribution repository publishing: not configured.
- Package signing keys: not configured or committed.

## Verified package metadata

| Item | Value |
| --- | --- |
| Product/executable | Picom / `Picom` |
| Category | `Network` |
| Maintainer | Picom Contributors |
| Synopsis | Premium desktop community chat app |
| Icon source | `assets/brand/icons/` multi-size PNG set |
| Artifact naming | `Picom-${version}-Linux-${arch}.${ext}` |
| deb category/priority | `net` / `optional` |

The generated desktop entry and package metadata must be inspected from the real Linux artifacts before release. Windows configuration verification is not a native Linux package pass.

## Native Linux build

Use a clean supported Linux x64 build host/runner:

```bash
npm ci
npm run env:placeholders:check
npm run qa:smoke
npm run typecheck
npm run mock:smoke
npm run build
npm run package:verify
npm run package:linux:appimage
npm run package:linux:deb
```

Expected outputs:

```text
release/Picom-<version>-Linux-x86_64.AppImage
release/Picom-<version>-Linux-x86_64.deb
```

Actual deb filename/architecture should be recorded from output because builder formatting can vary. Generate checksum/provenance after the final artifacts are complete.

## AppImage smoke

```bash
chmod +x "release/Picom-<version>-Linux-x86_64.AppImage"
"./release/Picom-<version>-Linux-x86_64.AppImage"
```

Verify terminal output contains no secret or private content. Also launch through the desktop environment after optional user-approved AppImage integration.

Some distributions require FUSE compatibility for AppImage. If the host does not provide it, document the distro/runtime requirement; do not silently install system packages or run untrusted extraction. `--appimage-extract-and-run` may be used only as an explicit test workaround and is not the default support promise.

## deb install and launch

On a disposable supported Debian/Ubuntu-family test host:

```bash
sudo apt install ./release/Picom-<version>-Linux-x86_64.deb
Picom
```

Then launch Picom from the desktop application menu and verify the Picom name/icon, `Network` category placement, single desktop entry, custom titlebar, and core MVP shell.

Inspect package metadata:

```bash
dpkg-deb --info ./release/Picom-<version>-Linux-x86_64.deb
dpkg-deb --contents ./release/Picom-<version>-Linux-x86_64.deb
```

Confirm no `.env`, certificate, token, development source map, or unexpected writable path is packaged.

## Uninstall and rollback

Identify the installed package name from `dpkg -l | grep -i picom`, then remove through the distro package manager. Do not hardcode or guess a package ID in automation.

```bash
sudo apt remove <verified-picom-package-name>
```

Verify application binaries, desktop entry, and menu shortcut are removed while unrelated user files remain untouched. Record user-data/cache behavior according to the deletion policy. Reinstall the previously approved artifact to prove manual rollback.

AppImage uninstall is removal of the verified artifact plus any user-created integration entry; never recursively delete user directories.

## Runtime dependency guidance

Electron packages normally require a supported glibc-based desktop stack and common GTK/NSS/X11/audio libraries. Exact package names differ by distro/version and should come from generated deb metadata and native smoke evidence, not an unverified universal list.

Validate on each supported distro:

- GTK/window manager behavior and tray/notification integration.
- NSS/certificate trust and secure `wss`/`https` connectivity.
- ALSA/PulseAudio/PipeWire microphone path.
- X11 or Wayland/PipeWire/xdg-desktop-portal screen capture.
- System font/rendering and 100/125/150% scaling.

If launch fails, record distro/version/session, terminal error, package dependency output, and redacted diagnostics. Do not advise disabling sandbox/system security as a normal fix.

## Wayland and X11 media checks

### X11

- Verify window/screen sources enumerate and remote screen share is visible.
- Verify custom titlebar drag/control behavior under the target window manager.

### Wayland

- Verify PipeWire and the desktop’s xdg-desktop-portal backend.
- Expect OS portal/source selection behavior to vary by compositor.
- Missing/denied portal access must show a safe error and leave voice/chat usable.

In both sessions, test microphone denial/grant, mute/deafen, speaking, share start/stop, room leave cleanup, and no capture after quit.

## Distribution gate

Repository distribution must additionally pass `docs/linux-repository-distribution.md`; direct AppImage/deb success does not authorize an apt/rpm repository or claim rpm support.

- AppImage and deb must each pass clean-host build, terminal/menu launch, install/uninstall/reinstall where relevant, custom chrome, core MVP, voice/screen-share, checksum, and artifact inspection.
- rpm, arm64, repository publishing, package signatures, AppStream metadata, and automatic updates are not claimed.
- No public distribution occurs until target distro/version support and remaining metadata gaps are approved.
