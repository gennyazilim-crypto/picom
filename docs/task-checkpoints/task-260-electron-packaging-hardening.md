# Task 260 - Electron Packaging Hardening Checkpoint

## Scope

Task 260 closes the current Electron packaging hardening pass for Picom's Windows, Linux, and macOS desktop builds.

## Confirmed packaging posture

- Product name remains `Picom`.
- App identifier remains `com.picom.desktop`.
- Default Electron window size remains `1440x900`.
- Minimum Electron window size remains `1100x700`.
- Native Electron menu is disabled.
- Custom Picom titlebar remains the only visible app chrome.
- `contextIsolation` is enabled.
- `nodeIntegration` is disabled.
- Renderer sandbox and web security remain enabled.
- Preload exposes the narrow `window.picomDesktop` bridge.
- Windows target is NSIS x64.
- Linux targets are AppImage x64 and deb x64.
- macOS targets are dmg x64 and zip x64 placeholders.
- Required Picom icon assets are present.
- Build/package outputs are ignored by Git.
- No Discord branding, logos, copied assets, or exact Discord colors are introduced by this packaging pass.

## Verification commands

Run these before platform package smoke tests:

```bash
npm run package:verify
npm run typecheck
npm run build
```

## Platform smoke-test documents

- `docs/windows-smoke-test.md`
- `docs/linux-smoke-test.md`
- `docs/macos-smoke-test.md`

## Known local limitation

On the current Windows workstation, local unpacked Electron packaging can fail at the temporary folder rename step with `EPERM`. The build and config checks pass before that local filesystem lock. Use the recovery steps in `docs/electron-packaging.md`.
