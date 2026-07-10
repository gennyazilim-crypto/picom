# Stable Release Distribution

Status date: 2026-07-10  
Distribution status: **Blocked - no artifacts published**

`docs/stable-go-no-go.md` records a No-Go decision. Under the release lock, Picom stable artifacts must not be uploaded, announced, or silently substituted while that decision is active.

## Artifact inventory

| Platform | Local artifact state | Distribution state |
| --- | --- | --- |
| Windows x64 | Unsigned beta-channel NSIS candidate exists in user temp | Not published |
| Linux x64 | No certified AppImage/deb | Not available |
| macOS x64 | No signed/notarized DMG/zip | Not available |

## Local Windows evidence

- Candidate name: `Picom-0.1.1-beta.1-beta-Windows-x64.exe`
- SHA-256: `3C38726EF2989049B37FB956E3452D93AF1E8C97BD57BEBF27E17D7DBA8A6248`
- This hash identifies only the local candidate from Task 357. It is not a public release checksum.

## Missing distribution requirements

- Final stable semver and channel metadata.
- Clean Windows, native Linux, and signed/notarized macOS candidates.
- Checksums generated together from the immutable final artifact set.
- Provenance tied to the final source commit and CI run.
- Approved release notes, known issues, legal links, and support URL.
- Go sign-offs and rollback/hotfix owner.

## Distribution procedure after a future Go

1. Build immutable artifacts on approved platform runners.
2. Verify install/launch/core-flow/uninstall evidence.
3. Generate SHA-256 and provenance from the same artifact set.
4. Attach release notes, known issues, support, and rollback instructions.
5. Upload to the approved release location without replacing artifacts in place.
6. Verify downloads and signatures/notarization from clean machines.
7. Start rollout at the internal ring and follow `docs/safe-rollout.md`.

No secrets, signing keys, private CI credentials, or artifacts were committed or published by this task.
