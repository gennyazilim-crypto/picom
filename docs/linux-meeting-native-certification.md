# Linux Meeting Native Certification

## Certification boundary

Task 579 certifies only native Linux x64 AppImage and DEB artifacts. Windows-produced cross-builds, renamed packages, containers without a desktop session, and contract-only tests are not native proof. RPM, ARM64, Flatpak, and Snap remain unsupported.

Both Wayland and X11 sessions are required for the current Linux support claim. The committed evidence remains `BLOCKED` because this task ran on Windows and no Linux artifact/session/device/remote client was available.

## Required environment inventory

Record redacted values for distro/version, kernel, x64 architecture, desktop environment, Wayland/X11 session, display scale, monitor count, PipeWire version, xdg-desktop-portal backend, audio stack, GPU family, and camera/microphone/speaker model families. Never record host names, device serials, account IDs, tokens, room names, screen content, audio, or raw media.

## Platform dependencies and limitations

- Wayland screen capture requires a working PipeWire service plus an appropriate xdg-desktop-portal backend for the desktop environment.
- Portal denial, cancel, unavailable service, no source, retry, OS-ended track, and reconnect must produce recoverable UI rather than insecure flags or silent failure.
- X11 and Wayland behavior must be tested separately; success under X11 does not prove the Wayland portal path.
- Audio behavior depends on the distro's PipeWire/PulseAudio compatibility stack and must be tested with real input/output switching.
- The Electron sandbox must remain enabled. `--no-sandbox` is not an accepted support workaround.
- AppImage FUSE/runtime requirements and DEB dependencies must be documented for the tested distro.

## Native execution

1. Build AppImage and DEB on an approved native Linux runner from the exact commit.
2. Compute SHA-256 for both artifacts and record immutable file names/versions.
3. Make the AppImage executable; inspect and install the DEB on a disposable supported host.
4. Run all 23 flows in `tests/native/linux-meeting-certification-matrix.json` under both Wayland and X11.
5. Use a distinct remote client for voice, camera, stage, screen share, remote render/stop, reconnect, and cleanup.
6. Verify the portal picker, denial/cancel/retry, screen publication, remote rendering, OS-ended stop, and ghost-track cleanup.
7. Confirm desktop entry/icon/protocol, custom controls/focus mode, sandbox, uninstall/reinstall, and no background/root side effects.
8. Store only redacted evidence under `docs/evidence/task-579/` and populate a separate evidence JSON matching `docs/evidence/task-579-linux-meeting.json`.
9. Run natively:

   `PICOM_LINUX_MEETING_CONFIRM=NATIVE_LINUX_ONLY node scripts/linux-meeting-native-certification.mjs --run --appimage <candidate.AppImage> --deb <candidate.deb> --evidence <redacted-evidence.json>`

The validator recomputes both hashes, checks the AppImage executable bit and DEB metadata, requires Wayland/X11 portal PASS evidence, and executes current package, Electron, meeting, device, and screen-share contracts. It does not install/uninstall packages, grant permissions, or capture media automatically.

Until native evidence passes, RB-04, RB-05, and RB-07 remain open.
