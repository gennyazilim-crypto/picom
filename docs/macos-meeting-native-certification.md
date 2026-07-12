# macOS Meeting Native Certification

## Certification boundary

Task 580 certifies only a native macOS x64 Picom candidate because the current protected artifact workflow emits x64 DMG/ZIP files. Apple Silicon/universal support is not claimed without a separate native build and evidence matrix.

The committed evidence remains `BLOCKED`. Static signing, entitlement, permission, Electron, meeting, and screen-share contracts do not prove Developer ID trust, notarization, Gatekeeper acceptance, TCC permission behavior, or remote media on final bytes.

## Trust chain

Certification requires the exact final candidate to pass all of the following before checksums are recorded:

- Developer ID Application signature on the app, frameworks, helpers, and native code;
- hardened runtime and reviewed least-privilege entitlements;
- accepted notarization with privately reviewed log;
- valid staple on app and DMG where applicable;
- Gatekeeper acceptance from a quarantined staged HTTPS download without bypass;
- SHA-256 for final post-staple DMG and ZIP plus matching provenance.

Apple certificates, private keys, notary API material, passwords, and keychain exports remain only in the protected macOS signing environment. Never include them in evidence, logs, source, cache, or artifacts.

## Native permission and meeting matrix

Record redacted macOS version, x64 hardware family, display scale, monitor count, and camera/microphone/speaker/GPU model families. Test each TCC path before grant, after grant, and after required restart:

- microphone denial/grant/restart and device switch;
- camera denial/grant/restart and remote render;
- Screen Recording denial/grant/restart, picker, publish, remote render, stop, and cleanup.

Then complete every flow in `tests/native/macos-meeting-certification-matrix.json` using a distinct remote client. Do not record audio, camera frames, screen content, source thumbnails, tokens, room names, or private data.

## Native execution

1. Build/sign/notarize/staple DMG and ZIP in the protected native macOS workflow from the exact commit.
2. Download through the staged HTTPS path so quarantine behavior is real.
3. Verify trust, compute final hashes, install from DMG, and run all 27 flows.
4. Store only redacted evidence under `docs/evidence/task-580/` and populate a separate evidence JSON matching `docs/evidence/task-580-macos-meeting.json`.
5. Run natively:

   `PICOM_MACOS_MEETING_CONFIRM=NATIVE_MACOS_ONLY PICOM_MACOS_EXPECTED_TEAM_ID=<approved-team> node scripts/macos-meeting-native-certification.mjs --run --app <Picom.app> --dmg <candidate.dmg> --zip <candidate.zip> --evidence <redacted-evidence.json>`

The validator recomputes post-staple hashes, requires every trust and meeting flow to pass with real references, invokes the fail-closed macOS signing verifier, and executes current Electron/meeting/device/screen-share contracts. It never imports Apple credentials, changes TCC permissions, installs/uninstalls, or captures media automatically.

Until native evidence passes, RB-04, RB-05, and RB-08 remain open.
