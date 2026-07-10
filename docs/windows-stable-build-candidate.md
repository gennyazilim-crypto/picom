# Windows Stable Build Candidate

Status date: 2026-07-10  
Candidate status: **Generated, not yet clean-machine certified**

## Build result

- Production renderer/Electron build: Passed.
- Packaging configuration verification: Passed.
- Windows x64 unpacked candidate: Generated successfully in a unique user temp output.
- Windows x64 NSIS installer: Generated successfully in a unique user temp output.
- Repository-local output attempt: Failed with Windows `EPERM` while renaming `win-unpacked.tmp`; using the temp output removed the filesystem lock.

## Candidate paths

- Unpacked executable: `C:\Users\ACER\AppData\Local\Temp\picom-task357-8a2ef49fbb0d40b2b978542d4ed931c9\win-unpacked\Picom.exe`
- Installer directory: `C:\Users\ACER\AppData\Local\Temp\picom-task357-installer-5f503d145bdd44c7873aec454348601f`
- Installer: `Picom-0.1.1-beta.1-beta-Windows-x64.exe`

These are local, unsigned candidate artifacts and are not public stable downloads.

## Startup smoke

Launching the unpacked executable returned exit code 0 because a current `npm run dev` Electron instance already held Picom's single-instance lock. The candidate handed control to the existing instance rather than crashing. The development process was not terminated automatically.

This does not replace a clean-machine launch test.

## Configuration checks

- Product name: Picom.
- App ID: `com.picom.desktop`.
- Executable: `Picom`.
- Default/current package version: `0.1.1-beta.1` with beta artifact channel naming.
- NSIS is per-user, non-one-click, and permits install-directory selection.
- Desktop and Start Menu shortcuts are configured.
- Icons resolve through `assets/brand` configuration.
- Native File/Edit/View menu remains disabled by the Electron application contract.
- Build is not production-signed; no certificate or password was committed.

## Required clean-machine smoke

1. Stop all existing Picom dev/installed processes.
2. Install the NSIS candidate on a clean Windows VM/device.
3. Launch and verify no white screen, custom titlebar, drag/minimize/maximize/restore/close, normal/maximized frame, and no native menu.
4. Verify login/register/session restore, onboarding, Mention Feed, profile, community/channel/message, upload, DM, settings/theme, diagnostics, voice, and screen-share source picker.
5. Reinstall/upgrade and uninstall; verify user data behavior matches policy.
6. Generate/check SHA-256 and archive redacted logs/screenshots.

RB-06 remains open until this matrix is complete. The artifact naming also still says beta, so a stable version/channel freeze is required before distribution.

## Task 399 closure attempt

Packaging, signing-process, first-launch, and installer-branding controls passed on 2026-07-10. No trusted certificate was loaded and no clean-machine matrix ran. The existing unsigned beta candidate remains internal-only; see `docs/windows-signed-clean-machine-matrix.md`.

## Task 411 real execution

Trusted signing and clean-machine release execution remained **BLOCKED**. No signed stable installer, post-signing checksum, trusted publisher result, or clean Windows test exists. See `docs/windows-trusted-signing-clean-machine.md`.

## Task 423 clean internal candidate

Task 423 produced a clean-worktree Windows x64 internal beta candidate from commit `1f2ad0e8df7d6458af815afb25a290a8b34dc93e`.

- Installer: `Picom-0.1.1-beta.1-beta-Windows-x64.exe`
- Size: 121,205,443 bytes
- SHA-256: `61301CB0E9BF74F91A29DC36BF29F4F4F9DB49DA24FEDCCEB305BAFC4923ADD0`
- Signature: NotSigned
- Unpacked startup: process alive after 8 seconds

This improves build evidence but does not replace clean-machine install, trusted signing, or remote screen-share certification.
