# Final Stable Release Candidate Artifact Inventory

Status date: 2026-07-10  
Inventory status: **No immutable stable artifact set exists**

| Platform | Required artifact | Current evidence | Final SHA-256 | Trust state |
| --- | --- | --- | --- | --- |
| Windows x64 | Signed NSIS installer | Unsigned beta candidate only | Not generated for final stable bytes | Blocked |
| Linux x64 | Native AppImage and deb | No native artifacts | Not generated | Blocked |
| macOS x64 | Signed/notarized/stapled DMG and zip | No native artifacts | Not generated | Blocked |

The historical Windows file `Picom-0.1.1-beta.1-beta-Windows-x64.exe` and its recorded checksum are excluded from the final inventory because the file is unsigned, beta-channel, not clean-machine certified, and not part of an immutable cross-platform stable set.

Required final inventory fields remain unassigned: stable version/channel, final source commit, native build runner, signed/notarized status, post-signing size/hash, provenance record, and approved download location. Artifacts must never be replaced under the same version.

## Task 411 Windows inventory update

No trusted signed Windows artifact was produced. The Windows row remains blocked and has no valid final stable SHA-256 or immutable release path.

## Task 415 final inventory review

No final immutable stable artifact set was built because prerequisite gates remain open. No unsigned beta file was relabeled, rehashed, or published as stable. Windows trusted signing, Linux native certification, and macOS signing/notarization must finish before post-signing SHA-256 values can exist.

## Task 426 Windows inventory decision

No protected signing run occurred and no trusted Windows bytes exist. The Task 423 unsigned beta checksum remains internal test evidence only and is not a final stable checksum. The Windows inventory row remains blocked.
