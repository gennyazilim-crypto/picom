# Task 377 Checkpoint: Installer Assets Finalization Pass

## Result

Finalized the current installer asset inventory and separated release-used
artwork from intentional placeholders.

## Verified inventory

- Windows header BMP: 150x57.
- Windows sidebar BMP: 164x314.
- macOS DMG background PNG: 660x400.
- Shared Picom app icon PNG: 1024x1024.
- Linux packages use the existing generated Picom icon directory.

## Safety controls

- Packaging smoke fails if `.placeholder.` artwork is referenced.
- Placeholder SVGs remain clearly named and documented as non-release sources.
- No product behavior or renderer layout changed.

## Remaining native QA

Final rendering must still be inspected in the Windows installer, macOS Finder
DMG, and representative GNOME/KDE environments before public distribution.
