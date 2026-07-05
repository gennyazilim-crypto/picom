# macOS Packaging

Task 251 configures macOS dmg/zip packaging for Picom.

## Target

- Builder: `electron-builder`
- Platform: macOS x64 placeholder
- Targets: dmg and zip
- Product name: `Picom`
- Category: `public.app-category.social-networking`

## Commands

```bash
npm run package:mac:dmg
npm run package:mac:zip
npm run package:mac
```

Run these commands on macOS or a macOS CI runner.

## Expected output

Artifacts are written to:

```text
release/
```

Expected naming:

```text
Picom-<version>-macOS-x64.dmg
Picom-<version>-macOS-x64.zip
```

## Permissions metadata

The macOS package config includes placeholder Info.plist usage text for:

- microphone access for MVP voice rooms
- screen recording access for user-initiated screen sharing

These strings should be reviewed before beta distribution.

## Signing and notarization

Local macOS builds are unsigned.

Production release still needs:

- Apple Developer certificate
- hardened runtime configuration
- entitlements review
- notarization workflow
- CI secret placeholders

Do not commit certificates, private keys, Apple credentials, app-specific passwords, or notarization secrets.

## Icon

macOS packaging currently references:

```text
assets/brand/app-icon.png
```

Before final release, generate a production `.icns` icon set from the final Picom logo.

## Manual verification

1. Run `npm run build`.
2. On macOS, run `npm run package:mac:dmg`.
3. Open the dmg and drag Picom to Applications if prompted.
4. Launch Picom.
5. Confirm the custom titlebar, 4-column layout, theme toggle, message composer, voice placeholders, and screen-share permission prompts behave safely.
6. Repeat with `npm run package:mac:zip` if zip distribution is needed.
