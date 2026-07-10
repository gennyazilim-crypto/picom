# Task 375 Checkpoint: Linux Package Metadata and Branding

## Result

Completed the Linux package branding configuration for AppImage and DEB without
changing renderer behavior.

## Implemented

- Standardized the Picom package synopsis and description.
- Added explicit desktop-entry name, comment, categories, terminal setting, and
  startup window class.
- Kept the existing original Picom icon source and package targets.
- Extended installer branding smoke coverage for Linux metadata.
- Documented native Linux build and desktop-entry QA steps.

## Validation boundary

Configuration, TypeScript, mock mode, and frontend builds can be validated on
Windows. Native AppImage/DEB launch and desktop-environment integration remain a
Linux-host QA step and are not reported as completed here.
