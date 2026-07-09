# Picom Linux Packaging and Distribution Policy

## Full MVP package set

| Format | Status | Intended use |
| --- | --- | --- |
| AppImage x64 | Configured | Portable/private beta and direct download candidate |
| deb x64 | Configured | Debian/Ubuntu-family install candidate |
| rpm | Not configured | Future only after Fedora/RHEL-family support decision |
| Distro repositories | Not configured | Post-MVP/release operations decision |
| Flatpak/Snap | Not configured | Not part of current scope |

## Desktop integration

- Product and executable are Picom.
- Category is `Network` (`net` for deb metadata).
- Multi-size PNG icons come from `assets/brand/icons`.
- deb should install a desktop entry/menu icon through electron-builder output.
- AppImage desktop integration is user/distro tooling dependent and must not silently modify the system.
- `picom://` protocol handling must be verified from each installed format/window manager.

## Artifact inspection

For every candidate:

- Verify source version/commit and artifact architecture.
- Inspect deb control/contents and AppImage extracted contents on a disposable host.
- Confirm main/preload/renderer outputs, icons, license/notices, and package metadata.
- Confirm no secrets, `.env`, signing keys, private source files, or unrelated assets.
- Generate SHA-256 and provenance after final packaging.
- Malware scan according to release policy without executing uploaded/untrusted test files.

## Signing boundary

No Linux package signing key is added in Full MVP. If public repository/package signatures are approved later, keys must live in protected release infrastructure with named owners, rotation/revocation, offline/restricted root where applicable, and documented verification instructions.

Direct private beta artifacts are distributed only through an approved location with SHA-256 and explicit unsigned status.

## Metadata gaps before broad distribution

- Native Linux build/smoke evidence is not available from Windows.
- Exact minimum distro/glibc/desktop environment support matrix is not approved.
- rpm and arm64 artifacts are absent.
- AppStream/metainfo, repository signing, update channels, and distro repository submission are not configured.
- Wayland portal behavior varies and requires distro/compositor-specific evidence.
- Tray/notification integration requires native desktop-environment testing.

These gaps do not require adding more package formats before AppImage/deb reliability is proven.

## Support evidence

Every Linux report should include artifact/version/hash, distro/version, kernel, architecture, desktop environment, Wayland/X11 session, audio stack, portal backend where relevant, launch method, reproduction steps, and redacted diagnostics. Do not collect passwords, tokens, private messages, or screen content.

## Rollout policy

1. Build and smoke on clean native CI/hosts.
2. Distribute to an internal Linux ring.
3. Expand to a small beta across the approved distro/session matrix.
4. Pause on installer/launch/private-data/capture blockers.
5. Add formats/distros only after ownership and support capacity are approved.
