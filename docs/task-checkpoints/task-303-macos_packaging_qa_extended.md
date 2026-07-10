# Task 303 - macOS packaging QA extended

Date: 2026-07-10  
Build host: Windows 10.0.26200, x64

## Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Mock mode smoke | PASS | `npm run mock:smoke` |
| TypeScript | PASS | `npm run typecheck` |
| Renderer + Electron build | PASS | `npm run build` |
| Packaging configuration | PASS | `npm run packaging:smoke` |
| DMG x64 | NOT RUNNABLE ON WINDOWS | electron-builder returned: `Build for macOS is supported only on macOS` |
| zip x64 | NOT RUNNABLE ON WINDOWS | Same macOS-host requirement |

No DMG, zip, signing, notarization, launch, or permission result is claimed from this Windows host.

## Configuration review

Base/local macOS configuration:

- Targets DMG and zip x64.
- Uses the Picom icon and social-networking category.
- Includes `NSMicrophoneUsageDescription` and `NSScreenCaptureUsageDescription`.
- Intentionally keeps `hardenedRuntime: false`, `gatekeeperAssess: false`, and no notarization for local/internal unsigned builds.

Protected release configuration (`electron-builder.macos-release.yml`):

- Enables hardened runtime.
- Enables notarization.
- References reviewed main/helper entitlement templates.
- Keeps microphone and screen-recording purpose strings.
- Contains no certificate, private key, password, App Store Connect API secret, or Team credential.

The existing `docs/release/macos-signing-notarization-final.md` remains the authoritative signing/notarization runbook.

## Unsigned and notarization status

- Local/internal macOS artifacts are expected to be unsigned and not notarized.
- Do not present an unsigned artifact as a public release candidate.
- Do not instruct testers to globally disable Gatekeeper or remove quarantine as an acceptance step.
- Production distribution requires Developer ID Application signing, hardened runtime, notarization, staple validation, Gatekeeper assessment, and a clean quarantine-path download test.
- Final checksums/provenance must be generated after signing, notarization, and stapling.

## Required macOS-native package and launch gate

Run on a clean supported Intel Mac or approved macOS CI/QA runner:

1. Run `npm ci`, `npm run mock:smoke`, `npm run typecheck`, and `npm run build`.
2. Build internal unsigned DMG/zip with `npm run package:mac` only for internal QA.
3. Build the protected candidate with `npm run package:mac:signed-candidate` in the approved signing environment.
4. Mount DMG, drag Picom to Applications, launch, quit, relaunch from Applications, and launch the zip-extracted app.
5. Verify custom titlebar, minimize/maximize/close behavior, drag area, theme, four-column shell, and no native File/Edit/View menu.
6. Verify Gatekeeper/quarantine from the actual staged HTTPS download; do not use a local copy as substitute evidence.
7. Run deep codesign, entitlement, notarization/staple, and Gatekeeper verification from the signing runbook.
8. Upgrade from the previous signed build and confirm settings/session migration and no white screen.
9. Uninstall/reinstall on a disposable account and verify expected user-data retention.

## Microphone permission gate

1. Confirm no microphone prompt appears at startup.
2. Join a staging LiveKit room and confirm the prompt appears just in time.
3. Test Allow, Deny, later enable in System Settings, permission revocation, app restart, and input-device disconnect.
4. Confirm denial leaves text/community UI usable and shows a safe explanation.
5. Confirm mute/deafen/reconnect/leave work with two clients and no duplicate participant.

## Screen recording permission gate

1. Confirm no screen-recording prompt appears before Choose source.
2. Test Deny/Cancel and verify the platform-specific System Settings guidance plus Try again.
3. Enable Picom under Privacy & Security > Screen Recording; restart Picom if macOS requires it.
4. Test entire-display and application-window sources, multiple displays, minimized/background behavior, and source-label truncation.
5. Confirm local preview and Stop sharing controls clear the published track immediately.
6. Confirm a second client renders the remote participant share once and removes it on stop/disconnect.
7. Confirm no thumbnails, screen content, tokens, or private source IDs enter logs/diagnostics.

## Remaining blockers

- DMG and zip must be produced and launched on macOS.
- Public candidate must be signed/notarized/stapled and pass Gatekeeper/quarantine checks.
- Microphone and screen-recording TCC flows require a real signed bundle identity and macOS System Settings.
- Voice and screen-share smoke requires staging Supabase/LiveKit plus two macOS clients.
- Apple Silicon artifact coverage is not configured in the current x64-only targets and requires a separately approved packaging decision.

## Non-blocking build warnings

- Renderer bundle chunk exceeds 500 kB.
- `voiceService` is both statically and dynamically imported, so the dynamic import does not create a separate chunk.
