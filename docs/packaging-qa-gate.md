# Packaging QA Gate

Picom's `packaging:smoke` command verifies that the Electron packaging configuration stays ready for Windows, Linux, and macOS smoke builds without adding signing secrets or changing the desktop UI.

## Covered behavior

- `electron-builder.yml` keeps Picom's original app id, product name, output directory, and artifact names.
- Windows, Linux, and macOS package targets remain configured.
- Native Electron chrome stays frameless, menu-free, sandboxed, and preload-based.
- Required placeholder icon assets and packaging docs are present.
- Active signing, notarization, or certificate secrets are not committed.
- Discord branding is not present in package metadata.

## Commands

```bash
npm run packaging:smoke
npm run qa:smoke
```

## Notes

This is a configuration smoke test, not an installer build. Actual package smoke tests still use the platform-specific package scripts and manual installer QA docs.
