# Feed, DM, and Community Production Release Checkpoint

Date: 2026-07-19

## Decision

- Windows beta/release-candidate technical scope: **GO**
- Feed, Direct Messages, and Community backend deployment: **GO**
- Public stable distribution: **NO-GO** until the remaining external release gates below are closed
- Linux and macOS packaging: not evaluated in this Windows release pass

This distinction is intentional. Product and backend readiness have passed, while an unsigned Windows installer must not be represented as a trusted stable release.

## Backend evidence

- The linked Supabase database reports all repository migrations applied.
- Nine final production migrations were applied during this release pass, including DM voice authorization, profile media, community policy grants, and RLS corrections.
- All 16 functions in the release function manifest were deployed to project `ufmtvqtsklqsmqxefbbs`.
- All 12 required remote secret names are configured; secret values were never printed or stored in this document.
- Supabase QA passed.
- Supabase RLS pgTAP suite passed: 14 files and 219 tests.

## Local release evidence

- `npm ci`: pass, zero dependency vulnerabilities reported
- `npm run typecheck`: pass
- `npm run mock:smoke`: pass
- `npm run qa:smoke`: pass
- `npm run supabase:qa`: pass
- `npm run supabase:rls:test`: pass
- `npm run release:v2:go-no-go:smoke`: pass
- `npm run build`: pass
- `npm run performance:budget:ci`: pass
- `npm run package:win`: pass

Final renderer budget evidence:

- Initial JavaScript: 1246.3 KiB, below the 1650 KiB hard cap
- Initial CSS: below the 322 KiB hard cap
- Total assets: 3693.4 KiB, below the 3700 KiB hard cap

## Windows artifacts

- Installer: `release/Picom-0.1.1-beta.4-beta-Windows-x64.exe`
- Installer size: 122,149,650 bytes
- Unpacked executable: `release/win-unpacked/Picom.exe`
- Installer and executable Authenticode state: `NotSigned`

The generated `release/` output is local release evidence and is intentionally excluded from Git.

## Remaining stable-release blockers

1. Obtain and apply a trusted Windows code-signing certificate.
2. Verify the signed installer and executable with Windows Authenticode/SmartScreen evidence.
3. Complete named legal and operations approvals required by the stable release gate.
4. Freeze the immutable stable artifact set and publish final checksums/provenance.
5. Run the clean-machine Windows install, upgrade, uninstall, and startup smoke against the signed artifact.

The stable Go/No-Go guard remains truthful and must continue to block public stable release until these real blockers are closed.
