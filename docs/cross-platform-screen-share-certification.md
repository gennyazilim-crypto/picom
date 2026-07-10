# Cross-Platform Screen Share Certification

Status date: 2026-07-10  
Overall result: **Local safety contracts passed; cross-platform certification blocked**

## Common safety checks

| Check | Result |
| --- | --- |
| Capture requires an explicit user source selection | Passed structural contract |
| Renderer uses safe preload/service APIs, not raw Electron/Node | Passed |
| Invalid IPC payloads are rejected | Passed deterministic fuzz test |
| Permission denial/retry state exists | Passed smoke contract |
| Preview and stop controls exist | Passed smoke contract |
| Leave/cleanup integration exists | Passed LiveKit structural smoke |
| Remote participant receives selected screen | Blocked, requires real LiveKit clients |

## Windows

- Source-picker, preview, stop, IPC, and permission-recovery contracts pass locally.
- A packaged interactive source selection plus remote-view test was not completed in this documentation pass.
- Required evidence: choose monitor/window, verify no capture before confirmation, view from client B, stop, leave, deny/retry permission, and repeat from the installed candidate.

Status: **Pending packaged/manual certification**.

## Linux

- Electron Builder targets AppImage and deb, but this Windows host is not a valid Linux certification host.
- Test under the supported desktop session, including Wayland/PipeWire portal and X11 behavior where supported.
- Record required runtime dependencies, source picker visibility, remote view, stop, and cleanup.

Status: **Blocked pending Linux host/runner**.

## macOS

- Builder metadata declares microphone and screen-recording usage descriptions.
- Certification must run on macOS with signed/notarized candidate behavior, first denial, System Settings enablement, retry/relaunch, remote view, stop, and cleanup.
- No Apple credentials or entitlements evidence was available on this Windows host.

Status: **Blocked pending macOS host, signing, and notarization**.

## Release impact

RB-05 remains open. Stable notes must not claim certified cross-platform screen sharing until every promised platform passes the interactive matrix.

## Task 398 closure attempt

Permission recovery, preview/stop, preload contract, and invalid-payload tests passed on 2026-07-10. No remote-client screen track was tested, and no native Linux or macOS runner evidence was available. The platform matrix remains blocked as detailed in `docs/cross-platform-screen-share-evidence-closure.md`.

## Task 408 Windows real execution

Windows certification was **BLOCKED** because no trusted exact RC, clean Windows test target, hosted voice room, or remote client was available. See `docs/windows-screen-share-certification.md`; structural tests are not presented as packaged remote-view proof.

## Task 423 Windows package evidence

A clean-worktree Windows x64 NSIS/unpacked beta candidate was built and hashed on 2026-07-11, and the unpacked process remained alive after startup. Structural screen-share contracts passed. No clean-machine install, interactive source selection, hosted publication, or remote-client view ran, so Windows screen-share certification remains **PARTIAL / BLOCKED**.

## Task 409 Linux real execution

Linux certification was **BLOCKED** because no native runner or verifiable Linux CI environment was available. X11/Wayland, PipeWire portal, package, audio, and remote-view behavior remain untested.

## Task 410 macOS real execution

macOS certification was **BLOCKED** because no native signed/notarized candidate, test device, microphone/Screen Recording permission flow, or remote client was available.
