# macOS Packaging Smoke Test

Task 254 hardens the macOS packaging verification path for Picom.

## Preconditions

- Run on macOS or macOS CI.
- Install dependencies with `npm install`.
- Local builds are unsigned.

## Commands

```bash
npm run build
npm run package:mac:dmg
npm run package:mac:zip
```

## Checks

- dmg and/or zip artifacts are created under `release/`.
- Artifact names start with `Picom-`.
- Product name is `Picom`.
- App ID is `com.picom.desktop`.
- Custom Picom titlebar is visible.
- No native File/Edit/View menu appears inside the app window.
- Default window size is 1440 x 900.
- Minimum window size is 1100 x 700.
- Voice microphone permission text appears only when joining voice.
- Screen recording permission text appears only when starting screen share.
- The 4-column desktop layout remains stable.

## Signing and notarization placeholders

Production macOS release still needs:

- Apple Developer signing certificate
- hardened runtime review
- entitlements review
- notarization workflow
- CI secret placeholders

Do not commit certificates, Apple credentials, app-specific passwords, or notarization secrets.
