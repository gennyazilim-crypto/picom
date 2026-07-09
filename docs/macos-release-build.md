# Picom macOS Release Build

## Current packaging scope

- Bundle identifier: `com.picom.desktop`.
- Product: Picom.
- Category: `public.app-category.social-networking`.
- Targets: dmg and zip.
- Architecture currently configured: x64.
- Icon source: `assets/brand/app-icon.png`.
- Permission descriptions: microphone and screen capture.
- Publishing: disabled (`publish: null`).

Apple Silicon is not currently built natively. An x64 artifact may require Rosetta and must not be advertised as native arm64/universal. Adding arm64/universal is a separate build/QA decision.

## Build host

Build, code signing, notarization, Gatekeeper, microphone, and Screen Recording verification require a native macOS host/runner. A Windows build/typecheck can validate shared source/config only and cannot claim a macOS package pass.

## Unsigned local beta build

Current committed configuration keeps `hardenedRuntime: false` and `gatekeeperAssess: false` for local unsigned packaging. Use only for private developer/beta smoke:

```bash
npm ci
npm run qa:smoke
npm run typecheck
npm run mock:smoke
npm run build
npm run package:verify
npm run package:mac:dmg
npm run package:mac:zip
```

Expected outputs:

```text
release/Picom-<version>-macOS-x64.dmg
release/Picom-<version>-macOS-x64.zip
```

Unsigned/quarantined artifacts can be blocked by Gatekeeper. Do not instruct testers to disable Gatekeeper globally. Use approved private artifacts, verify checksum, and document the limitation.

## Stable signed build gate

Before a public stable candidate:

- Apple Developer Program/team is approved.
- Developer ID Application certificate is available only through protected keychain/CI signing storage.
- Hardened runtime is enabled and required entitlements are reviewed.
- App/bundle identifier, version, team, permission strings, and icon are final.
- Notarization credentials are stored only in protected CI/keychain profile.
- dmg and zip are signed/notarized/stapled or packaged from the notarized app using the approved workflow.
- Native macOS install/upgrade/uninstall, Gatekeeper, permission, protocol, voice, and screen-share smoke passes.

Do not enable hardened runtime/notarization in committed config until the signing pipeline and entitlements are proven together.

## Runtime smoke

1. Mount dmg and copy Picom to Applications; also test zip extraction separately.
2. Launch from Finder with quarantine metadata intact.
3. Verify publisher/Gatekeeper result appropriate to the candidate type.
4. Verify custom Picom titlebar/window controls without duplicate native menu/chrome.
5. Verify normal and zoom/maximized frame behavior, light/dark theme, login/session, community/channel navigation, local messaging, Settings, and diagnostics.
6. Verify `picom://` callback handling using an approved test link.
7. Run microphone and screen-recording denial/grant/restart tests from `docs/macos-permissions.md`.
8. Close/quit and verify no stale capture or process remains.

## Install, upgrade, and uninstall

- Clean install from dmg and zip.
- Upgrade over the previous approved beta while preserving safe local settings/session state.
- Verify only one Applications entry and expected protocol handler.
- Uninstall by quitting/removing the app according to release instructions; do not remove user data silently unless the deletion policy explicitly requires it.
- Reinstall prior approved artifact to prove manual rollback.

## Artifact evidence

Record source commit, app version, architecture, macOS/Xcode/Node/Electron versions, artifact bytes, SHA-256, codesign identity/team, notarization submission/result ID, staple validation, Gatekeeper result, build host/runner, and smoke tester. Never include Apple credentials or certificate private material.
