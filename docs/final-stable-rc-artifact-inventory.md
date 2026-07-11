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
# Task 430 final inventory decision (2026-07-11)

**Release decision: NO-GO.** No immutable stable release artifact was produced or promoted by Task 430.

| Platform | Stable artifact | Signature/notarization | Final checksum | Final provenance | Status |
| --- | --- | --- | --- | --- | --- |
| Windows x64 | None | Not available | Not generated | Not generated | BLOCKED |
| Linux AppImage/DEB | None | Not applicable/unverified | Not generated | Not generated | BLOCKED |
| macOS DMG/ZIP | None | Not signed, notarized, or stapled | Not generated | Not generated | BLOCKED |

The unsigned Windows beta artifact validated during Task 423 is test evidence only. It is not an immutable stable RC, is excluded from the stable inventory, and must not be distributed as a trusted production release.

Task 430 evaluated source commit `5d01d1ce09d050c90cc2eaf6ae841e9054022d88`. A clean detached worktree passed the deterministic release contracts, but unresolved hosted, native, legal, ownership, and restore gates prohibit final artifact generation.

## Task 520 disk inventory and classification (2026-07-11)

Audit baseline: `eac79e261e9f1af96f0dd7e7957c1ae11ad7a8ef`. The following files were observed read-only and were not created, modified, hashed, signed or published by Task 520:

| Path | Bytes | Classification | Stable inventory |
| --- | ---: | --- | --- |
| `release/Picom-0.1.0-Windows-x64.exe` | 120,374,587 | Historical unsigned Windows artifact | Excluded |
| `release/Picom-0.1.0-Windows-x64.exe.blockmap` | 126,848 | Historical update metadata | Excluded |
| `release/Picom-0.1.1-beta.1-Windows-x64.exe` | 120,375,860 | Unsigned beta Windows artifact | Excluded |
| `release/Picom-0.1.1-beta.1-Windows-x64.exe.blockmap` | 126,847 | Beta update metadata | Excluded |
| `release/win-unpacked/Picom.exe` | 235,715,584 | Unpacked development runtime | Excluded |
| `release-task-301/win-unpacked.tmp/electron.exe` | 235,706,368 | Temporary/incomplete package output | Excluded |
| `release-task-357-20260710/win-unpacked.tmp/electron.exe` | 235,706,368 | Temporary/incomplete package output | Excluded |

Developer outputs `dist` (95 files, 3,560,933 bytes at audit time) and `dist-electron` (51 files, 605,544 bytes) are not desktop release artifacts. No stable Linux AppImage/deb or macOS DMG/zip was found. No final stable checksum, signature, notarization, provenance or approved download location exists.

Task 520 decision: the final stable artifact inventory remains empty and **BLOCKED**. Existing files must not be relabeled or published as stable.
