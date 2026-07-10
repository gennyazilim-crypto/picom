# Windows Screen Share Package Certification

Status date: 2026-07-11  
Result: **PARTIAL / BLOCKED**

## Environment

| Field | Evidence |
| --- | --- |
| OS | Windows 11 Home, version `10.0.26200`, build `26200` |
| Architecture | x64 |
| Monitor count | 1 |
| Display scale | Not reliably reported by the available system query |
| GPU | Not reliably reported by the available system query |
| Source commit | `1f2ad0e8df7d6458af815afb25a290a8b34dc93e` |

## Clean package evidence

The candidate was built from a detached clean worktree so existing user-owned Iconix/AppIcon changes were not included or modified.

| Field | Result |
| --- | --- |
| Artifact | `Picom-0.1.1-beta.1-beta-Windows-x64.exe` |
| Size | 121,205,443 bytes |
| SHA-256 | `61301CB0E9BF74F91A29DC36BF29F4F4F9DB49DA24FEDCCEB305BAFC4923ADD0` |
| Authenticode | `NotSigned` as expected for internal Task 423 candidate |
| Unpacked startup | Process remained alive after 8 seconds with isolated user-data directory |
| Publication | None; artifact retained only in a local temporary evidence directory |

An earlier package from the dirty primary worktree was rejected as release evidence and is not listed as the candidate.

## Deterministic screen-share evidence

- Permission denial/retry contract: PASS.
- Preview/source-label/stop controls: PASS.
- Quality preset contract: PASS.
- Renderer native API boundary: PASS.
- Safe preload contract: PASS.
- Production renderer/Electron build: PASS.

## Interactive matrix

| Scenario | Result |
| --- | --- |
| Installed NSIS first launch | BLOCKED; no isolated clean Windows target |
| Explicit source picker click | BLOCKED; no interactive operator session captured |
| Cancel before capture | BLOCKED |
| Full-screen share | BLOCKED |
| Application-window share | BLOCKED |
| Remote client view | BLOCKED; hosted LiveKit/two-client environment unavailable |
| Stop/restart/leave cleanup | BLOCKED for real media |
| Multi-monitor | BLOCKED; only one monitor present |
| Permission/error behavior | PASS structurally, BLOCKED interactively |
| No automatic capture | PASS structurally; capture path requires explicit picker selection |

## Decision

The clean Windows package and startup smoke are real, but they do not certify screen sharing. RB-05 remains open. The unsigned beta artifact is internal-only and is not a trusted stable candidate.

