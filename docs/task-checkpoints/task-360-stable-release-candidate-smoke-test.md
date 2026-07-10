# Task 360 checkpoint: Stable release candidate smoke

## Result

**Not ready**

## Passed

- Windows local candidate generation.
- Artifact naming, checksum, provenance, RC dry-run, and local QA contracts.
- SHA-256 recorded for the Windows installer candidate.

## Blocked

- Linux and macOS artifacts.
- Clean-machine Windows smoke.
- Hosted Supabase/RLS/Realtime/Storage/Edge flows.
- Real LiveKit and cross-platform screen sharing.

## Commands

- `npm run release:artifact-naming:test`
- `npm run release:checksums:smoke`
- `npm run release:provenance:smoke`
- `npm run rc:dry-run:smoke`
- `npm run qa:smoke`
- `Get-FileHash ... -Algorithm SHA256`
