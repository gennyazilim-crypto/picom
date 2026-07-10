# macOS Developer ID, Notarization, and Staple Validation

Status date: 2026-07-10  
Result: **Not ready - native macOS signing evidence unavailable**

## Configuration evidence

- Release-only Electron Builder configuration enables hardened runtime, notarization, and reviewed entitlement templates.
- Microphone and screen-capture usage descriptions are declared.
- The production notarization smoke verifies required signature, Gatekeeper, staple, post-stapling checksum, and protected-secret workflow contracts.
- No Apple certificate, keychain password, Apple ID, app-specific password, team ID, or notary credential was loaded or committed.

## Native matrix

| Check | Result |
| --- | --- |
| Developer ID signature and nested helpers | Blocked |
| Entitlement verification | Blocked on built app |
| Apple notarization submission | Blocked |
| Ticket stapling | Blocked |
| Gatekeeper acceptance | Blocked |
| DMG/zip clean-machine launch | Blocked |
| Microphone permission flow | Blocked |
| Screen Recording denial/recovery/relaunch | Blocked |
| Final post-staple checksum | Blocked |

## Required completion

Build `package:mac:signed-candidate` on an approved macOS runner with protected Developer ID and notarization credentials. Verify nested signatures, entitlements, notarization success, staple, `spctl`, clean-machine DMG/zip behavior, permissions, voice/screen share, uninstall/reinstall, then generate checksums from the stapled bytes.

## Recommendation

**Not ready.** RB-08 remains open. Static workflow success is not Apple signing or notarization evidence.
