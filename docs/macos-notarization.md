# Picom macOS Signing and Notarization Plan

## Required identities and secrets

- Apple Developer Program team.
- Developer ID Application certificate/private key.
- Notarization credential: protected keychain profile, App Store Connect API key, or Apple ID app-specific password flow approved by release operations.
- Apple Team ID where required.

Never commit certificates/private keys, `.p12`, API private keys, Apple ID, app-specific passwords, keychain exports, or notarization credentials. Do not expose them through Vite, renderer, logs, diagnostics, issues, or artifact metadata.

## Hardened runtime and entitlements

Stable Developer ID distribution requires hardened runtime. Enable it only in the secure release configuration after Electron/LiveKit/microphone/screen-share entitlements are reviewed and tested.

Principles:

- Grant only entitlements required by the packaged Electron runtime/media features.
- Keep library validation/JIT Electron requirements aligned with the supported Electron version and official guidance.
- Do not add broad file, network server, automation, camera, location, or personal-data entitlements without a product requirement.
- Permission usage descriptions do not replace entitlements/signing requirements.

## Recommended protected pipeline

1. Check out an approved release commit on a protected macOS runner.
2. Install dependencies with lockfile and run quality/package verification.
3. Import/use the Developer ID certificate from protected signing storage.
4. Build the app with hardened runtime and reviewed entitlements.
5. Verify the app signature before packaging.
6. Submit with `xcrun notarytool` using a protected keychain profile/CI credential.
7. Wait for Accepted result; retrieve redacted failure log if rejected.
8. Staple ticket to app/dmg where applicable and validate.
9. Run Gatekeeper and clean-machine smoke.
10. Generate final checksum/provenance only after signing/notarization/stapling.

Illustrative verification commands on macOS:

```bash
codesign --verify --deep --strict --verbose=2 "Picom.app"
codesign -dv --verbose=4 "Picom.app"
xcrun notarytool submit "Picom.dmg" --keychain-profile "PICOM_NOTARY" --wait
xcrun stapler staple "Picom.dmg"
xcrun stapler validate "Picom.dmg"
spctl --assess --type execute --verbose=4 "Picom.app"
shasum -a 256 "Picom.dmg"
```

The profile name is non-secret; its credentials stay in the protected keychain. Never print command environments.

## Expected stable result

- `codesign` strict verification passes.
- Developer ID signer/team match the approved Picom publisher.
- Notary submission is Accepted.
- Staple validation passes for distributable artifacts.
- Gatekeeper assessment accepts the quarantined downloaded artifact.
- No nested executable/helper has an invalid or ad-hoc signature.
- Permission prompts use Picom text and final bundle identity.

## Rejection handling

1. Stop distribution; preserve the failed artifact privately.
2. Fetch notarization log by submission ID without exposing credentials.
3. Identify unsigned nested code, invalid entitlements, hardened runtime, metadata, or malware-policy issue.
4. Fix source/config and rebuild from a new approved commit.
5. Never re-label a rejected artifact or replace checksums silently.
6. Repeat signature, notarization, staple, Gatekeeper, and runtime smoke.

## Credential compromise

Pause releases, revoke/rotate affected Apple credentials/certificate, audit CI access and signed artifacts, open a security incident, and obtain replacement signing identity before resuming.

## Local beta boundary

Unsigned local beta may remain unnotarized with explicit warning and private distribution. It is not evidence for stable public readiness.
