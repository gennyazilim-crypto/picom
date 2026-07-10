# Picom Linux distribution finalization

## Supported distribution targets

| Format | Architecture | Current config | Release status |
|---|---|---|---|
| AppImage | x64 | Configured | Direct/internal beta candidate after native Linux smoke |
| Debian package (`.deb`) | x64 | Configured | Debian/Ubuntu-family beta candidate after native install/upgrade/remove smoke |
| RPM | None | Not configured | Unsupported; future Fedora/RHEL-family decision |
| apt/rpm repository | None | Not configured | Future operations/security scope |
| Flatpak/Snap | None | Not configured | Out of current scope |
| ARM64 | None | Not configured | Unsupported until separate build/runtime QA |

The current Windows development environment cannot certify Linux artifacts. Final AppImage/deb builds and tests must run on native Linux CI/hosts from the exact release commit.

## Current electron-builder metadata

Base configuration provides:

- Product/executable: `Picom`
- Application ID: `com.picom.desktop`
- Category: `Network` (`net` in deb package metadata)
- Maintainer: `Picom Contributors` placeholder requiring final release owner/contact review
- Description/synopsis for desktop community chat
- Multi-size PNG icons from `assets/brand/icons`
- x64 AppImage and deb targets
- Artifact name `Picom-${version}-Linux-${arch}.${ext}`
- `picom://` custom protocol declaration
- ASAR packaging and sandboxed Electron renderer
- `publish: null` (no repository/auto-update publishing)

Do not claim RPM/repository support because checksum tooling can recognize `.rpm`; recognition is not a package target.

## Native build workflow

On an approved clean Linux builder:

```bash
npm ci
npm run typecheck
npm run mock:smoke
npm run build
npm run packaging:smoke
npm run package:linux:appimage
npm run package:linux:deb
```

Build in separate clean jobs where practical and archive:

- artifact
- SHA-256 checksums generated after final packaging
- provenance (commit/version/channel/Node/Electron/builder/runner class)
- package inspection report
- smoke-test result by distro/session

No signing/repository key, Supabase/LiveKit secret, `.env`, local cache, or developer home path belongs in artifacts/provenance.

## Desktop entry verification

electron-builder should generate/install the desktop entry for deb; AppImage desktop integration depends on launcher/distro tooling and must not silently alter the host.

Extract/inspect candidate artifacts and verify the generated desktop entry:

- `Name=Picom`
- executable command resolves to packaged Picom, not a development path
- icon name/file resolves at required sizes
- `Categories` contains the approved `Network` category and valid terminator
- `Type=Application`
- no `Terminal=true`
- protocol/deep-link argument handling is quoted and does not execute arbitrary shell input
- no unknown/development URL, local username, or absolute build-machine path
- localized names/comments are added only after i18n approval

Use native tools where available:

```bash
desktop-file-validate <path-to-extracted-or-installed-picom.desktop>
grep -E '^(Name|Exec|Icon|Type|Categories|Terminal|MimeType)=' <path-to-picom.desktop>
```

After deb install, verify menu launcher and:

```bash
xdg-mime query default x-scheme-handler/picom
```

Protocol opening must pass only validated `picom://` routes to the existing deep-link service. Unknown/malformed links must show a safe error and never become shell arguments.

## Icon requirements

The repository includes 16, 32, 64, 128, 256, 512, and 1024 pixel PNG assets plus source/fallback formats. Verify from the built package, not only source:

- correct Picom original branding at launcher, task switcher, notifications, tray, and file/menu surfaces
- no white square/incorrect alpha, stale old logo, or distorted non-square scaling
- icons installed under expected hicolor paths for deb
- desktop entry references the installed icon correctly
- AppImage runtime finds the icon without external source paths
- light/dark desktop themes remain legible

Do not include unlicensed third-party/Discord assets.

## Dependencies

electron-builder generates deb dependencies according to its current target/runtime configuration. Do not hardcode a copied dependency list without inspecting the actual control file.

For every deb candidate:

```bash
dpkg-deb --info Picom-<version>-Linux-x64.deb
dpkg-deb --contents Picom-<version>-Linux-x64.deb
```

Review package name/version/architecture/maintainer/section/priority/dependencies, installed paths, desktop file, icons, executable permissions, and protocol integration.

Native QA must cover:

- a supported Debian and Ubuntu baseline selected for release
- glibc/runtime compatibility and missing shared-library output (`ldd` only on extracted trusted binaries)
- X11 and Wayland sessions where supported
- PipeWire/PulseAudio behavior for voice/screen share
- xdg-desktop-portal backend for screen capture/file dialogs
- secret-service/keyring availability and fallback session persistence behavior
- libnotify/tray/status notifier integration where enabled
- FUSE/AppImage compatibility on selected distros

If a distro needs additional user-installed libraries or AppImage runtime support, document exact official package guidance by distro/version. Do not download arbitrary libraries or suggest globally weakening system security.

## Electron sandbox and native security

Picom main process currently creates the renderer with `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, and web security enabled. Linux distribution must preserve this.

- Do not ship `--no-sandbox` in desktop entry, wrapper, launcher, docs, or support workaround.
- Do not require root to run Picom.
- Do not set broad setuid/capabilities on the Picom executable to mask packaging errors.
- Verify Chromium/Electron sandbox starts on supported kernels/distributions and user namespaces/container policy.
- Keep external navigation, webview attachment, IPC, file, shell, protocol, and screen-capture boundaries enforced.
- AppImage extraction/debug mode is not default installation and does not establish sandbox support.
- Packaging in a container does not prove the packaged app works under a user's desktop session/portal/keyring/audio stack.

A distro where the only working launch path disables the sandbox is not supported until a secure packaging/runtime solution is reviewed.

## AppImage distribution

### Intended use

- Portable direct download/internal beta.
- User marks trusted verified artifact executable and launches it without system package installation.
- Updates are manual replacement because production auto-update/publish is disabled.

### Verification

```bash
sha256sum Picom-<version>-Linux-x64.AppImage
chmod u+x Picom-<version>-Linux-x64.AppImage
./Picom-<version>-Linux-x64.AppImage
```

Run only after checksum/provenance verification from the approved source. Test normal launch, second instance/deep link, custom titlebar, file dialogs, tray/notifications, voice/screen share, sleep/wake, and clean exit.

Inspect trusted artifact in disposable workspace with AppImage extraction tooling; verify resources contain no secrets/source env/unexpected binaries and the desktop entry/icon metadata is correct.

### Uninstall

1. Quit Picom and confirm no process/tray instance remains.
2. Delete the AppImage file.
3. If the user explicitly installed desktop integration through trusted launcher tooling, remove that tool's Picom desktop entry/icon records according to its documented path.
4. User settings/cache are not deleted automatically. Clearing them requires a separate explicit privacy/support action; never remove home directories via package uninstall script.

Do not present AppImage deletion as account deletion or server-data deletion.

## Debian package distribution

### Install/upgrade

On a disposable supported host after signature/checksum/source verification:

```bash
sudo apt install ./Picom-<version>-Linux-x64.deb
```

Test fresh install, menu launch, CLI launch, upgrade from previous known-good version, downgrade/rollback compatibility where supported, reinstall, and removal. Verify package scripts do not start background services, change firewall, modify unrelated user files, or run Picom as root.

### Uninstall

Use the package manager and verify the actual generated package name first:

```bash
dpkg-query -W | grep -i picom
sudo apt remove picom
```

Use `purge` only if the package explicitly owns system configuration and the release notes explain impact. User-local Picom settings/cache and server account data must not be silently removed. Account deletion remains an authenticated in-app workflow.

After removal verify desktop menu, icon, protocol handler, process/tray, and package-owned files are gone while unrelated/user data is preserved.

## RPM decision

RPM is not configured or accepted. Adding it requires:

- Fedora/RHEL-family support matrix and native CI
- electron-builder `rpm` target/config and dependency metadata review
- RPM package name/category/license/maintainer/scriptlet review
- install/upgrade/downgrade/remove tests under dnf/rpm
- SELinux/Wayland/portal/audio/tray tests
- package/repository signing and key rotation/revocation plan
- support capacity and release artifact/checksum/provenance integration

Do not rename a deb/AppImage, use an unreviewed converter, or publish an RPM placeholder as supported.

## Optional package repository later

An apt/rpm repository may improve trusted updates but is intentionally post-current scope. It needs:

- dedicated HTTPS hosting/CDN and immutable artifacts
- metadata generation and offline/restricted root plus online signing key hierarchy
- key distribution, expiration, rotation, revocation, compromise response
- repository channel separation (internal/beta/stable)
- atomic publish/rollback and mirror/cache behavior
- apt/dnf metadata/signature verification instructions
- monitoring, availability, cost, retention, and incident owner
- privacy/legal/export/compliance review

Repository signing keys never enter Electron, source, normal CI logs, or user diagnostics.

## Updates and rollback limitations

`publish: null` means Picom does not currently publish Linux update metadata, and production auto-update is not finalized.

- AppImage users manually replace with a verified newer/older artifact.
- deb users install a verified package through apt/manual file path; repository version pinning is unavailable.
- Rollback must check backend minimum/recommended version and local settings migration compatibility.
- Never distribute two different artifact bytes under the same version/filename/checksum.
- Pause/withdraw bad artifact, publish known-good/hotfix with new provenance/checksum, and provide format-specific instructions.
- Do not tell users to delete local settings/cache unless corruption is confirmed and recovery impact is clear.

## Native release test matrix

Select and publish exact supported versions before release. Minimum matrix placeholder:

| Format | Distro family | Session | Required flows |
|---|---|---|---|
| AppImage | Ubuntu LTS | Wayland + X11 | Launch/integration/core/voice/share/tray/protocol |
| AppImage | Fedora current (runtime evaluation only; RPM unsupported) | Wayland | Launch/sandbox/portal/audio |
| deb | Debian stable | X11/available Wayland | Install/upgrade/remove/dependencies/core |
| deb | Ubuntu LTS | Wayland + X11 | Install/menu/protocol/voice/share/tray |

Also test no keyring/portal/audio device, microphone/screen denial, offline/reconnect, multi-monitor/DPI, sleep/wake, safe mode, crash recovery, and unsigned artifact warning/verification messaging.

## Artifact release gate

- [ ] Native clean Linux CI/host build from approved commit.
- [ ] AppImage and deb package inspection clean and metadata correct.
- [ ] Desktop entry validates; icon/category/protocol work.
- [ ] Dependency and supported distro/session matrix approved.
- [ ] Electron sandbox remains enabled; no insecure launch flag.
- [ ] Install/upgrade/uninstall and user-data preservation verified.
- [ ] Auth/community/chat/upload/realtime/voice/share/private access smoke passes.
- [ ] SHA-256/provenance produced after final bytes and verified.
- [ ] Unsigned/signing status and update limitations stated accurately.
- [ ] Rollback/support/incident owners and known issues ready.
- [ ] RPM/repository/ARM64/Flatpak/Snap not claimed.

Until native evidence passes, Linux artifacts remain internal candidates, not finalized public distribution.
