# macOS Package Smoke Test

Picom supports macOS desktop packaging in the MVP scope. This checklist is intentionally platform-specific and must be run on macOS for a real pass.

## Prerequisites

- macOS development machine.
- Node dependencies installed with `npm install`.
- No production secrets in `.env`.
- Build artifacts are generated under `release/`, which is ignored by git.

## Build commands

```bash
npm run typecheck
npm run mock:smoke
npm run build
npm run package:verify
npm run package:mac
```

Target-specific commands:

```bash
npm run package:mac:dmg
npm run package:mac:zip
```

## Configuration checks

- macOS targets include `dmg` and `zip`.
- macOS category is `public.app-category.social-networking`.
- macOS icon path is `assets/brand/app-icon.png`.
- Microphone permission text is present.
- Screen capture permission text is present.
- Unsigned local packaging limitations are documented.
- Native File/Edit/View menu remains disabled in the app window.
- `contextIsolation` is enabled.
- `nodeIntegration` is disabled.

## Runtime smoke checklist

- Launch the `.app` from the zip or dmg.
- Confirm the app opens without a renderer crash.
- Confirm no duplicate native chrome appears inside the app window.
- Confirm the custom Picom titlebar is visible and compact.
- Confirm window controls behave safely on macOS.
- Confirm normal window mode keeps the premium frame.
- Confirm maximized/zoomed mode does not leave accidental outer padding.
- Confirm the 4-column desktop layout renders.
- Confirm Home/Mention Feed opens.
- Confirm community/channel switching works.
- Confirm mock message sending works.
- Confirm light/dark theme toggles.
- Confirm no mobile UI appears.

## Voice and screen share permission notes

- Microphone permission prompt should use the configured Picom explanation.
- Screen recording permission may require System Settings approval and app restart.
- LiveKit server connectivity is not required for this package smoke unless specifically testing voice.

## Pass criteria

- macOS package launches.
- MVP shell remains usable.
- No native menu/chrome regression is visible.
- Permission prompts are understandable and Picom-branded.

## Release lifecycle and security

- Run dmg and zip clean-install, prior-beta upgrade, uninstall/remove, reinstall, and manual rollback checks from `docs/macos-release-build.md`.
- Run denial/grant/restart tests in `docs/macos-permissions.md` on the final bundle identity.
- For stable candidates, require the signing/notarization/staple/Gatekeeper checks in `docs/macos-notarization.md`.
- Record whether the candidate is x64, arm64, or universal; current config produces x64 only.

## Known limitations

- Signing and notarization are placeholders in local development.
- Gatekeeper behavior for unsigned builds is outside this local smoke test.
- Windows source/build success is not a macOS package, signing, notarization, or native permission pass.
