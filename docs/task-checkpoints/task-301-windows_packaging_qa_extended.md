# Task 301 - Windows packaging QA extended

Date: 2026-07-10  
Host: Windows 10.0.26200, x64

## Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Mock data/service smoke | PASS | `npm run mock:smoke` |
| Renderer TypeScript | PASS | `npm run typecheck` |
| Renderer + Electron production build | PASS | `npm run build` |
| Electron packaging config | PASS | `npm run packaging:smoke` |
| Windows NSIS x64 package | PASS with output-path workaround | `electron-builder --win --x64` produced the installer in a unique LocalAppData Temp directory |
| Packaged executable startup | PASS | `win-unpacked/Picom.exe` remained alive for a 10-second isolated-profile smoke and was then stopped cleanly |
| Authenticode signature | EXPECTED BETA WARNING | `Get-AuthenticodeSignature` returned `NotSigned` |

Generated artifact during this QA run:

- `Picom-0.1.1-beta.1-Windows-x64.exe`
- Size observed: 121,131,085 bytes
- Build output: `%LOCALAPPDATA%/Temp/picom-task301-1783684753`

The Temp artifact is test evidence, not a published release artifact.

## Packaging issue observed

Packaging to `C:/Users/ACER/Desktop/picom/release-task-301` failed at Electron archive extraction with:

`EPERM: operation not permitted, rename win-unpacked.tmp -> win-unpacked`

The same source and configuration packaged successfully to a new `%LOCALAPPDATA%/Temp` directory. This indicates a Windows filesystem/Defender/indexer lock on the Desktop output path rather than an application build failure. Release automation should use a clean, non-synchronized build workspace and unique output directory.

## Unsigned beta warning

The current Windows installer is intentionally unsigned. Windows SmartScreen may show an unknown-publisher warning. Do not tell users the package is signed. Public beta promotion requires the separate code-signing gate, timestamp verification, publisher-name verification, and a clean-machine install test.

## Manual install/uninstall/reinstall gate

This run did not silently install over the operator's existing Picom registration, shortcuts, or user data. The following must be executed on a disposable Windows QA account or VM before release:

1. Confirm no prior Picom installation exists, or record its version and user-data path.
2. Launch the generated NSIS installer interactively.
3. Confirm the expected unsigned/unknown-publisher warning and do not bypass any unexpected security warning.
4. Install for the current user to the default location.
5. Confirm Start menu and desktop shortcuts target the installed `Picom.exe`.
6. Launch Picom and verify the custom titlebar, minimize, maximize/restore, close, drag area, theme toggle, and absence of the native File/Edit/View menu.
7. In mock mode, verify app shell, community/channel switching, local message send, image selection/upload preview, and no mobile UI.
8. With staging Supabase configured, verify login/session restore, message send, and an image upload.
9. With staging LiveKit configured, join/leave a voice room, mute/deafen, reconnect, and start/stop one screen share.
10. Uninstall from Windows Installed Apps and confirm binaries/shortcuts are removed. User data should be retained unless the uninstaller explicitly and safely offers deletion.
11. Reinstall the same package and repeat startup/login/message smoke.
12. Reinstall over an older signed or beta build in a separate upgrade test; confirm settings migration and no white screen.

## Not claimed as passed

- Interactive install, uninstall, and reinstall on a disposable Windows environment.
- Visual window-control behavior in the packaged build.
- Staging Supabase login, message, and upload flow.
- Two-client LiveKit voice and screen-share flow.
- SmartScreen reputation behavior beyond the verified `NotSigned` status.

These remain release-blocking manual QA items, not silent successes.

## Remaining non-blocking build warnings

- Renderer bundle chunk exceeds 500 kB.
- `voiceService` is both statically and dynamically imported, so the dynamic import does not create a separate chunk.
