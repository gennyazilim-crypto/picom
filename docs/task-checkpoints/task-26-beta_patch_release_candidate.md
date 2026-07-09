# Task 26 Checkpoint: Beta Patch Release Candidate

## Candidate

- Version: `0.1.1-beta.1`
- Channel: beta
- Windows installer: `release/Picom-0.1.1-beta.1-Windows-x64.exe`
- Size: `120375860` bytes
- SHA-256: `35B558C25F6BC6F0E2BAE812A707655B051995B83028B9E2D7567137A806AFA0`
- Blockmap: present
- Distribution: private beta only; no public publishing performed

## Changes

- Bumped package/build identity from `0.1.0` to `0.1.1-beta.1`.
- Updated the renderer version fallback and environment example.
- Added patch release notes and a focused patch checklist.
- Updated package candidate and beta release identity with the real Windows artifact.

## Validation

- `npm run env:smoke` - passed.
- `npm run settings:diagnostics:smoke` - passed.
- `npm run desktop:smoke` - passed.
- `npm run typecheck` - passed.
- `npm run mock:smoke` - passed.
- `npm run build` - passed.
- `npm run package:win` - passed; Windows x64 NSIS installer and blockmap created.

## Scope and limitations

- No production auto-update or public publishing was added.
- The Windows candidate is unsigned; SmartScreen warnings can occur.
- Linux and macOS artifacts still require native build hosts and native smoke tests.
- Supabase and LiveKit connected verification still requires configured staging environments.
- The existing Vite large-chunk warning remains non-blocking.
