# Task 302 - Linux packaging QA extended

Date: 2026-07-10  
Build host: Windows 10.0.26200, x64 (cross-build attempt)

## Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Mock mode smoke | PASS | `npm run mock:smoke` |
| TypeScript | PASS | `npm run typecheck` |
| Renderer + Electron build | PASS | `npm run build` |
| Packaging configuration | PASS | `npm run packaging:smoke` before and after metadata fix |
| Linux unpacked x64 stage | PASS | Electron Linux runtime and application files were assembled in LocalAppData Temp |
| AppImage x64 | BLOCKED ON WINDOWS HOST | AppImage staging required a Unix symlink and Windows returned `EPERM` |
| deb x64 | BLOCKED ON WINDOWS HOST | Linux unpacked stage passed; package stage could not spawn Linux `fpm` (`ENOENT`) |
| rpm | NOT CONFIGURED | Current approved targets are AppImage and deb only |

No Linux artifact is claimed as release-ready from this Windows cross-build.

## Integration issue fixed

electron-builder reported that the generated desktop entry could not reliably associate a running Electron window without matching desktop metadata. Added:

- `desktopName: Picom` in `package.json`.
- `linux.syncDesktopName: true` in `electron-builder.yml`.

This keeps the generated desktop entry/application WM_CLASS aligned.

## Desktop entry and icon verification

- Product/executable name: Picom.
- Linux category: Network.
- Icon source: `assets/brand/icons`.
- Available PNG sizes: 16, 32, 64, 128, 256, 512, and 1024 pixels.
- AppImage and deb x64 remain the configured Linux targets.

Final `.desktop` fields and installed icon-cache behavior must be inspected from a Linux-native package build.

## Sandbox and permissions notes

- Electron renderer settings remain `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Do not ship a launcher that permanently adds `--no-sandbox`.
- AppImage users may need FUSE support or AppImage extraction depending on distribution policy; document the supported path per release.
- deb installs should declare only generated runtime dependencies and must not request root at app runtime.
- Microphone access is requested only when the user joins/uses voice controls.
- Screen capture is requested only after explicit source selection.
- On Wayland, screen capture depends on the desktop portal/PipeWire path; denial must show Picom's existing recovery guidance.
- X11 and Wayland must both be tested; no claim is made that Windows cross-build validates either display server.

## Required Linux-native QA gate

Run on a clean supported Linux VM or physical host:

1. Install Node/npm dependencies and the packaging prerequisites including `fpm` for deb generation.
2. Run `npm run mock:smoke`, `npm run typecheck`, and `npm run build`.
3. Run `npm run package:linux:appimage` and `npm run package:linux:deb`.
4. Inspect the generated `.desktop` file: Name, Exec, Icon, Categories, StartupWMClass, and protocol handler.
5. Verify all installed icon sizes and desktop/menu association.
6. Mark AppImage executable and launch without `--no-sandbox`.
7. Install deb, launch, uninstall, and reinstall on a disposable environment.
8. Confirm custom titlebar controls, drag area, theme, four-column shell, and no mobile UI on X11 and Wayland.
9. Verify mock login/community/channel/message/image-preview flows.
10. With staging Supabase, verify login, message, and attachment upload.
11. With staging LiveKit, verify voice join/leave, mute/deafen, reconnect, microphone device handling, screen-source portal, local preview, remote preview, and stop sharing.
12. Confirm microphone/screen permission denial and retry do not crash the app.

## Remaining blockers

- AppImage and deb must be built and installed on Linux-native CI/QA.
- Voice and screen-share smoke needs configured staging LiveKit and two Linux clients.
- Wayland portal behavior requires a real Wayland session.
- Linux package signing/repository trust is a separate release gate.

## Non-blocking build warnings

- Renderer bundle chunk exceeds 500 kB.
- `voiceService` is both statically and dynamically imported, so the dynamic import does not create a separate chunk.
