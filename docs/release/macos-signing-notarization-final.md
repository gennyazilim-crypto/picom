# Picom macOS signing and notarization finalization

## Status and safe default

Picom's base electron-builder configuration intentionally keeps macOS local/internal builds unsigned with `hardenedRuntime: false` and no notarization. This avoids silently selecting a developer's personal Keychain identity and avoids a misleading half-configured hardened-runtime build.

Public direct distribution is blocked until a protected macOS CI runner signs with the approved **Developer ID Application** identity, enables hardened runtime with reviewed entitlements, submits to Apple's notary service, reviews the result, staples the ticket, and verifies Gatekeeper on a clean Mac.

No Apple certificate, private key, `.p12`, API `.p8`, app-specific password, Keychain, team/key/issuer value, profile, token, or credential is committed.

Official references:

- [Apple: Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Apple: Configuring the hardened runtime](https://developer.apple.com/documentation/xcode/configuring-the-hardened-runtime/)
- [Apple: Developer ID](https://developer.apple.com/support/developer-id/)
- [electron-builder: macOS notarization](https://www.electron.build/docs/notarization/)
- [electron-builder: macOS code signing](https://www.electron.build/docs/features/code-signing/code-signing-mac/)

## Distribution model

This plan covers direct download distribution (`.dmg` and optionally `.zip`), not the Mac App Store. Direct distribution uses:

1. Apple Developer Program team controlled by the approved Picom legal publisher.
2. Developer ID Application certificate for the `.app` and nested executable code.
3. Hardened runtime with least-privilege entitlements.
4. Apple notarization through current `notarytool`/supported electron-builder integration.
5. Stapled ticket for offline Gatekeeper verification where supported.
6. Final checksum/provenance and clean-host quarantine/Gatekeeper smoke.

A future `.pkg` target may additionally require a Developer ID Installer certificate. Picom currently targets DMG/ZIP, so do not procure/configure installer identity without that scope.

## Local unsigned beta limitations

Local/internal unsigned build:

```bash
npm ci
npm run package:mac:dmg
```

Expected limitations:

- Must run on macOS; Windows/Linux cannot produce trustworthy signed/notarized Mac release evidence.
- No verified publisher identity or notarization ticket.
- Gatekeeper/quarantine can block first launch or require explicit approval in System Settings.
- Microphone and screen-recording TCC prompts/behavior may differ from final signed bundle.
- Unsigned/ad-hoc results are not stable release candidates and must be clearly labeled internal.
- Do not tell testers to disable Gatekeeper or remove quarantine globally.
- Checksum proves downloaded bytes only, not publisher identity.

The base config does not request ad-hoc signing. If an internal ad-hoc path is later needed, it must be a separate explicit config and test; do not mix it with production Developer ID evidence.

## Protected production CI

Requirements:

- Current supported macOS runner and approved Xcode command-line tools.
- Protected release tag/environment approval; no signing secrets in fork/pull-request jobs.
- Individual MFA-controlled Apple Developer/App Store Connect access.
- Dedicated Developer ID Application certificate and least-privilege notarization credential.
- Ephemeral Keychain/runner or hardware/managed key storage; private key never uploaded as normal artifact/cache/log.
- Exact commit, version, release channel, Node/npm/Electron/electron-builder/Xcode/macOS versions recorded in provenance.
- Signing/notarization logs stored in restricted release evidence and redacted before normal issue tracking.

Recommended notarization authentication for ephemeral CI is an App Store Connect API key with the minimum approved role. If certificate export is required, electron-builder may consume `CSC_LINK` and `CSC_KEY_PASSWORD` through protected ephemeral variables. The `.p8` API key and `.p12` certificate are downloaded/exported only under approved controls, rotated/revoked when exposed, and never stored in Git.

Blank inventory variables in `.env.production.example` are names only:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `APPLE_TEAM_ID`

The actual build system may use a secured Keychain profile or workload identity instead. Select one reviewed approach and document it privately; do not leave multiple automatic identities discoverable on the release host.

## Hardened runtime and entitlements

Notarized direct-distribution release must set `hardenedRuntime: true`. The base config remains false for unsigned local safety; protected release CI must use a reviewed config override with:

```yaml
mac:
  hardenedRuntime: true
  notarize: true
  entitlements: assets/brand/entitlements.mac.plist
  entitlementsInherit: assets/brand/entitlements.mac.inherit.plist
```

Committed templates currently contain:

- `com.apple.security.cs.allow-jit` for Electron/V8 JIT under hardened runtime.
- `com.apple.security.cs.allow-unsigned-executable-memory` because some Electron internals/versions require it; verify current Electron and remove if proven unnecessary.
- `com.apple.security.device.audio-input` for microphone access.

Security review rules:

- Do not add `com.apple.security.get-task-allow` in production.
- Do not add `allow-dyld-environment-variables`.
- Do not add `disable-library-validation` unless packaged runtime testing proves a signed nested framework/plugin requirement and security approves the reduction.
- No plugin runtime/native arbitrary library loading is in current scope.
- Main and inherited/helper entitlements must be inspected from the final signed bundle, not assumed from source.
- Every entitlement needs a product feature, threat review, test, and removal owner.

The templates are not active in local config and do not claim notarization readiness by themselves.

## Microphone permission

`electron-builder.yml` includes `NSMicrophoneUsageDescription` explaining that Picom uses microphone access only when the user joins a voice channel. Production requirements:

- Purpose text is accurate, localized where supported, and approved by product/legal.
- Picom requests access just in time, not at startup.
- Denial keeps text chat usable and provides a safe explanation/open-system-settings path where appropriate.
- Repeated denial does not prompt-loop.
- Device selection and LiveKit token issuance never bypass macOS TCC.
- Audio is not recorded/stored unless a separately reviewed recording feature is implemented (currently out of scope).
- Test first grant, denial, later grant, revoked permission, device disconnect, app upgrade, and reinstall behavior.

## Screen recording permission

`NSScreenCaptureUsageDescription` states that Picom uses screen recording only when the user chooses screen share. Current direct-distribution plan relies on macOS Screen Recording TCC/purpose text; no blanket extra entitlement is added without official need and signed-bundle testing.

Requirements:

- Source picker appears only after explicit user action.
- No capture starts before source selection and LiveKit publish confirmation.
- Denial/cancel leaves voice/text app stable and does not expose thumbnails after close.
- UI explains that macOS may require enabling permission in System Settings and restarting/retrying the app.
- Stop share immediately unpublishes/releases capture tracks and previews.
- Test entire screen/window sources, denial, revocation, app restart, multiple displays, and minimized/background behavior.
- Do not record or retain screen-share media in diagnostics/logs.

## Signing and notarization sequence

1. Checkout approved clean tag/commit on protected macOS CI.
2. `npm ci` and run quality/security/packaging gates.
3. Build final `.app`/DMG/ZIP using production hardened-runtime override.
4. Sign the app and every nested framework/helper/native executable with the expected Developer ID identity/entitlements.
5. Verify deep signature before notarization.
6. Submit the final supported artifact using electron-builder/notarytool with protected credentials and wait for completion.
7. Retrieve and review the notary log; warnings are not silently ignored.
8. Staple ticket to the app/DMG as appropriate and validate stapling.
9. Verify Gatekeeper assessment/quarantine behavior on a clean Mac.
10. Generate checksums **after** all signing/notarization/stapling bytes are final.
11. Generate provenance, scan artifact, run install/upgrade/uninstall/core-flow smoke, then publish immutable artifacts.

Apple no longer accepts legacy `altool` notarization uploads; use current notary tooling supported by the selected Xcode/electron-builder release.

## Verification commands

Run on the final mounted/extracted application using release paths:

```bash
codesign --verify --deep --strict --verbose=2 "Picom.app"
codesign --display --verbose=4 "Picom.app"
codesign --display --entitlements :- "Picom.app"
spctl --assess --type execute --verbose=4 "Picom.app"
xcrun stapler validate "Picom.dmg"
```

Where appropriate, validate the app ticket as well. Release evidence should show:

- expected `com.picom.desktop` bundle ID and Picom product/version
- expected Developer ID publisher/team in private approval record
- hardened runtime enabled
- only reviewed entitlements on app/helpers
- deep signature valid with no unsigned nested executable
- notarization accepted and notary log reviewed
- stapler validation successful
- Gatekeeper assessment accepted
- final artifact checksum matches published `SHA256SUMS.txt`

Do not publish private key/certificate/API credential details through verbose logs.

## Quarantine and clean-host test

Artifacts downloaded through browsers receive `com.apple.quarantine`; copying a locally built file does not reproduce the real user path. Test from the actual staged HTTPS distribution path on a clean supported Mac account:

1. Download DMG/ZIP without removing quarantine attributes.
2. Verify checksum and signing/notarization/staple status.
3. Open/mount and drag/install normally.
4. Confirm Gatekeeper names the expected verified developer and does not require unsafe bypass.
5. Launch custom-titlebar Electron app and test auth, community/chat, uploads, voice, screen share permission, protocol links, tray/notifications, sleep/wake, and settings migration.
6. Upgrade from previous signed build and verify local data/session compatibility.
7. Uninstall and verify expected app/protocol cleanup without deleting user data unexpectedly.

Never use `xattr -dr com.apple.quarantine` as release acceptance evidence. It may be a private diagnostic step only under security guidance, not user installation advice.

## Failure handling

### Signing failure

- Reject candidate; do not notarize/publish partially signed app.
- Inspect nested code, identity selection, entitlement mismatch, and Keychain/CI access without dumping secrets.
- Rebuild from approved clean commit after fix.

### Notarization rejection

- Preserve submission ID/log privately.
- Review every issue/warning, signature, hardened runtime, entitlement, nested code, and bundle metadata.
- Fix/rebuild/resign/resubmit; do not staple or publish rejected bytes.

### Staple/Gatekeeper failure

- Stop release even if notary submission says accepted.
- Validate internet/offline ticket path, correct artifact, quarantine, signature, and download origin.

### Credential/certificate compromise

- Freeze releases, revoke certificate/API key, rotate Apple/CI access, audit submissions/signatures, preserve evidence, assess malicious notarized artifacts/tickets, notify Apple/security/legal, obtain replacement, and follow incident/postmortem process.

## Unsigned beta communication

Internal testers must be told:

- build is unsigned/not notarized and not a stable distribution
- Gatekeeper may block it
- checksum/source channel to verify
- no instruction to disable macOS security globally
- microphone/screen permission behavior may differ from final release
- where to report exact macOS/Picom version and redacted diagnostics

Public beta should use signed/notarized artifacts unless security/product explicitly approve a limited internal-only exception.

## Final release gate

- [ ] Apple Developer team and Picom legal publisher approved.
- [ ] Developer ID Application certificate and renewal/revocation owner ready.
- [ ] Protected macOS CI, least privilege, secret masking, and no fork access proven.
- [ ] Production config enables hardened runtime/notarization and reviewed entitlements.
- [ ] Microphone/screen purpose text and just-in-time permission flows approved/tested.
- [ ] Deep signature, entitlements, notary log, staple, Gatekeeper, and quarantine tests pass.
- [ ] Clean install/upgrade/uninstall and Windows/Linux/macOS-compatible backend flows pass.
- [ ] Final checksums/provenance generated after stapling.
- [ ] Incident, rollback, credential rotation, and support communication paths approved.

Until all evidence exists, Picom's macOS release remains local/internal unsigned and is not production-ready.
