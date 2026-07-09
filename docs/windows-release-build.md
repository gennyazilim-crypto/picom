# Picom Windows Release Build

## Supported output

- Platform: Windows x64.
- Installer: assisted NSIS executable (`oneClick: false`).
- Per-user install (`perMachine: false`, `requestedExecutionLevel: asInvoker`).
- Custom install directory, Desktop shortcut, and Start Menu shortcut enabled.
- MSI is not currently configured and is not required for Full MVP.

## Verified application metadata

| Item | Value |
| --- | --- |
| Product | Picom |
| App ID | `com.picom.desktop` |
| Executable | `Picom.exe` |
| Icon | `assets/brand/app-icon.ico` |
| Protocol | `picom://` |
| Default window | `1440x900` |
| Minimum window | `1100x700` |
| Native menu | disabled |
| Window frame | custom frameless titlebar |
| Context isolation | enabled |
| Node integration | disabled |
| Renderer sandbox | enabled |

## Clean build prerequisites

- Supported Node/npm version and a clean `npm ci` install.
- Windows build host with sufficient disk space and no stale Picom/Electron process locking `release/`.
- No populated `.env.production` or signing secret in the checkout.
- Exact approved source commit/version/release channel.
- Signing credentials only when producing an approved signed stable candidate.

## Build commands

```powershell
npm ci
npm run env:placeholders:check
npm run qa:smoke
npm run typecheck
npm run mock:smoke
npm run build
npm run package:verify
npm run package:win
```

Expected beta patch output:

```text
release/Picom-0.1.1-beta.1-Windows-x64.exe
release/Picom-0.1.1-beta.1-Windows-x64.exe.blockmap
release/win-unpacked/Picom.exe
```

`release/` is ignored and artifacts must not be committed.

## Configuration gate

`npm run package:verify` confirms product/app identity, NSIS target, icons, custom window dimensions/chrome, Electron hardening, preload boundary, protocol wiring, artifact naming, and absence of active signing credentials in committed config.

Do not re-enable the native File/Edit/View menu or create a second titlebar to address packaging issues.

## Installer smoke

### Clean install

1. Verify filename, version, SHA-256, and signing status from the approved release record.
2. Run the installer as a standard user.
3. Select a test install directory when prompted.
4. Confirm Start Menu and Desktop shortcuts use the Picom icon/name.
5. Launch and verify no white screen/startup error, native menu, duplicate chrome, or mobile layout.
6. Verify login/mock shell, custom controls, normal/maximized frames, theme, community/channel navigation, local message send, Settings, and diagnostics.

### Upgrade

1. Install the prior approved beta.
2. Preserve a normal non-sensitive local settings/session test state.
3. Install the new candidate over it.
4. Verify version/About/Diagnostics, session handling, theme/settings migration, and core MVP flows.
5. Confirm only one Picom installation/shortcut entry is present.

### Uninstall

1. Close Picom, including tray/background process.
2. Uninstall through Windows Installed Apps or the provided uninstaller.
3. Confirm binaries/shortcuts/uninstall entry are removed.
4. Confirm unrelated user files are untouched.
5. Record whether Picom user-data/cache remains according to the documented deletion policy; do not silently delete drafts/session data during a normal uninstall unless explicitly designed.
6. Reinstall and launch to prove a supported recovery path.

Use `docs/windows-smoke-test.md` for the full runtime checklist.

## Unsigned beta behavior

Local/private beta installers may remain unsigned and can trigger SmartScreen/Unknown Publisher warnings. Testers must verify the checksum and approved source location. Never instruct users to disable Windows security globally.

Current locally built `0.1.1-beta.1` candidate was checked with `Get-AuthenticodeSignature` and reports `NotSigned`.

## Artifact finalization

After the final build/signing step:

```powershell
Get-AuthenticodeSignature .\release\Picom-<version>-Windows-x64.exe | Format-List
Get-FileHash .\release\Picom-<version>-Windows-x64.exe -Algorithm SHA256
```

Record artifact bytes, SHA-256, Authenticode signer/thumbprint/status, timestamp service/result, source commit, build host/runner, build date, and smoke result. Generate hashes only after signing because signing changes the file.

## EPERM recovery

If electron-builder cannot rename `win-unpacked.tmp`, close only Picom project Vite/Electron processes and Explorer windows using the output. Verify the target is inside this repository before removing only incomplete temporary output. Never terminate unrelated Electron/Codex processes or recursively delete an unverified path.

## Distribution gate

- Private beta: unsigned allowed with explicit warning/checksum and approval.
- Stable/public: require approved signing decision, clean-host install/upgrade/uninstall smoke, artifact checksum/provenance, rollback artifact, release notes, and go/no-go approval.
- This build task never publishes automatically; `publish: null` remains configured.
