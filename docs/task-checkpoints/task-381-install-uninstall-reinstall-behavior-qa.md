# Task 381 Checkpoint: Install Uninstall Reinstall Behavior QA

## Result

Created a platform-specific, safe install/upgrade/uninstall/reinstall matrix and
confirmed the package configuration preserves local data on normal uninstall.

## Confirmed by configuration

- Windows assisted installer supports a chosen install directory.
- Desktop and Start Menu shortcuts are configured.
- Automatic app-data deletion on uninstall is disabled.
- Local window state uses Electron's runtime user-data directory.
- Artifact names identify version, channel, platform, and architecture.

## Not executed automatically

No existing developer installation, user-data directory, auth session, or
profile was deleted. Clean-account Windows installation and native macOS/Linux
reinstall matrices remain manual release-candidate evidence requirements.
