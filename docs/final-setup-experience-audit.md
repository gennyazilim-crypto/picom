# Final Setup Experience Audit

Date: 2026-07-10  
Candidate: Picom `0.1.1-beta.1`  
Scope: Tasks 371-385, installer branding, first launch, packaging, artifacts,
localization, legal/signing preparation, and release channel configuration.

## Executive decision

- Internal beta setup QA: **Go with known non-public blockers**.
- Public stable installer distribution: **No-Go**.

The implementation is structurally ready for controlled native-platform testing.
Public release remains blocked by real signing/notarization evidence, approved
legal text/license, and clean install/upgrade/uninstall/reinstall evidence on all
supported operating systems.

## Completed setup experience

- Original Picom installer identity and asset inventory.
- Windows assisted NSIS wizard with header/sidebar artwork, desktop/Start Menu
  shortcuts, optional custom install path, launch-after-finish, and preserved
  local app data on normal uninstall.
- macOS DMG background and Applications drag layout, plus reviewed permission
  descriptions and protected notarization configuration path.
- Linux AppImage/DEB product metadata and desktop-entry fields.
- Five-step first-launch setup before auth with versioned local persistence.
- Immediate light/dark selection and development-only safe reset tool.
- No permission prompt or capture/media call during first launch.
- English/Turkish setup copy with system-language default and manual switch.
- Final artifact naming, SHA256 generation/verification, provenance, and
  explicit-only stable channel behavior.
- Installer legal document integration map and preserved third-party notices.

## Automated evidence

All commands below passed on Windows on 2026-07-10:

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run first-launch:smoke`
- `npm run installer:branding:smoke`
- `npm run package:verify`
- `npm run release:channel:installer:smoke`
- `npm run release:artifact-naming:test`
- `npm run release:checksums:smoke`
- `npm run release:provenance:smoke`
- `npm run windows:signing:production:smoke`
- `npm run macos:notarization:production:smoke`
- `npm run linux:repository:distribution:smoke`
- `npm run licenses:smoke`
- `npm run legal:publication:gate:smoke`
- `npm run secrets:smoke`

An unsigned Windows NSIS candidate was also generated successfully during Task
373. It was not installed/uninstalled automatically on the developer profile.

## Platform readiness matrix

| Area | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Configuration/build contract | Pass | Pass | Pass |
| Original package branding | Pass | Pass | Pass |
| Native visual setup QA | Pending clean test account | Pending macOS host | Pending GNOME/KDE hosts |
| Install/upgrade/remove/reinstall | Pending full matrix | Pending full matrix | Pending AppImage/DEB matrix |
| Production trust | Pending trusted signature | Pending Developer ID/notary/staple | Pending chosen distribution/signature evidence |
| Public release | No-Go | No-Go | No-Go |

## Critical public-release blockers

1. Select/approve Picom's project and installer license; complete operator,
   jurisdiction, privacy, and policy review.
2. Produce and verify a trusted Windows signature on the final NSIS bytes.
3. Produce macOS Developer ID signature, notarization, staple, Gatekeeper, and
   clean-host DMG evidence.
4. Build/test AppImage and DEB on supported Linux hosts; approve repository/package
   signing approach for the intended distribution method.
5. Complete clean install, upgrade, uninstall, reinstall, shortcut, data
   preservation, first-launch, and localization matrices on every platform.
6. Generate real candidate SHA256/provenance after final signing/notarization and
   approve the Go/No-Go checklist.

## Known non-blocking engineering warnings

- Vite reports an ineffective dynamic import for `voiceService` because other
  startup paths import it statically.
- The main renderer chunk exceeds the current 500 kB warning threshold.

These do not block setup correctness but should be handled through the existing
bundle/startup performance plan before broad stable rollout. They were not
refactored in this installer-focused task set.

## Safety findings

- No signing, notarization, repository, Supabase service-role, or LiveKit secret
  was added to runtime code.
- Setup does not request native/media permissions.
- Placeholder installer artwork is rejected if referenced by packaging.
- Draft legal text is not presented as binding installer acceptance.
- Stable channel is never inferred from missing configuration.
- Normal Windows uninstall does not silently delete local user data.
- No native app/API behavior was added directly to React components.

## Recommended next actions

1. Run the Windows clean-account assisted-installer matrix and collect evidence.
2. Complete legal/license review before adding any binding installer acceptance.
3. Configure protected Windows signing and verify the final signed candidate.
4. Run native macOS DMG/sign/notary and Linux AppImage/DEB matrices.
5. Generate final checksums/provenance, run RC dry run, and complete Go/No-Go.

Do not publish from the local `release` directory or rename an unsigned beta
artifact into a stable artifact.
