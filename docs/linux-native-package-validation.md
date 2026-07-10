# Linux Native AppImage and DEB Validation

Status date: 2026-07-10  
Result: **Not ready - native Linux runner unavailable**

## Configuration evidence

- Electron Builder declares x64 AppImage and deb targets.
- Package metadata, desktop entry, icon path, category, maintainer, safe install policy, signing lifecycle, and rollback documentation passed structural smoke.
- rpm remains intentionally outside release scope because it is unverified.

## Native evidence

No Linux host or verifiable Linux CI artifact was available. This Windows machine cannot certify AppImage symlinks, executable behavior, deb dependency resolution, desktop integration, microphone backends, or PipeWire/portal screen sharing.

| Matrix | Result |
| --- | --- |
| AppImage native build and launch | Blocked |
| deb native build/install/launch | Blocked |
| Desktop entry and icon | Blocked on installed package |
| Login/community/message/upload | Blocked on native package |
| Voice and microphone | Blocked |
| Wayland/X11 screen share | Blocked |
| Uninstall/reinstall/data retention | Blocked |
| Final native checksums | Blocked |

## Required completion

Run the documented AppImage/deb commands on an approved Linux x64 host. Record distribution, version, desktop environment, X11/Wayland, PipeWire and `xdg-desktop-portal` versions, package dependencies, full desktop smoke, and checksums generated from the final native artifacts.

## Recommendation

**Not ready.** RB-07 remains open; Windows cross-build output is not Linux evidence.
