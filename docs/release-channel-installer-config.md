# Release Channel Installer Configuration

## Channels

- `dev`: local/internal development. Unsigned and never publicly promoted.
- `beta`: limited testers and staged beta distribution.
- `stable`: public production candidate after all release gates and explicit
  protected CI selection.

Stable is never inferred from a missing variable. Protected stable CI must set
`VITE_RELEASE_CHANNEL=stable` and use a stable SemVer. The current
`0.1.1-beta.1` candidate derives `beta` when no explicit runtime channel is
provided, preventing About/package mismatch in a beta build.

## Alignment contract

The following values must agree:

1. `package.json` SemVer.
2. `VITE_APP_VERSION` injected into the renderer.
3. `VITE_RELEASE_CHANNEL` selected by protected CI.
4. electron-builder `${channel}` in artifact names.
5. packaged `picomReleaseChannel` metadata.
6. About diagnostics, provenance, checksums, and release notes.

Artifact pattern:

```text
Picom-<version>-<channel>-<platform>-<arch>.<ext>
```

## Promotion rules

- Dev artifacts cannot be renamed into beta/stable artifacts.
- Beta-to-stable requires a new approved version/build, not byte replacement.
- Stable requires signing/notarization evidence, native install QA, smoke tests,
  legal approval, checksums, provenance, rollout decision, and Go sign-offs.
- No channel configuration enables production auto-update.
- Kill switches and client/server compatibility remain separate controls.

## Verification

```bash
npm run release:channel:installer:smoke
npm run release:artifact-naming:test
npm run release:provenance:smoke
npm run package:verify
```
