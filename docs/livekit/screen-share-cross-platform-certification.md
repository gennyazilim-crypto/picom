# Screen Share Cross-Platform Certification

## Status

This document defines the release certification procedure for Picom screen sharing on Windows, Linux, and macOS. The implementation is not considered cross-platform certified until the matrix below has been completed on physical or representative virtual machines and evidence has been attached to the release candidate.

Picom uses Electron's safe desktop capture bridge for source selection and LiveKit for publishing the selected video track. Renderer components must continue to use the existing service abstractions rather than Electron or LiveKit APIs directly.

## Certification preflight

- Test the exact release candidate commit and packaged desktop artifact.
- Record the Picom version, Electron version, operating system version, display server, and LiveKit environment.
- Use a staging LiveKit project and non-sensitive test accounts.
- Use two clients: one sharing and one remote observer.
- Confirm camera, microphone, and screen-sharing permissions are in a known state before each scenario.
- Do not capture private notifications, credentials, tokens, or unrelated desktop content in evidence.
- Export only redacted Picom diagnostics when investigating failures.

## Common certification matrix

| ID | Scenario | Expected result | Windows | Linux | macOS |
| --- | --- | --- | --- | --- | --- |
| SS-01 | Open source picker | Window and screen sources are presented without renderer or preload errors. | Pending | Pending | Pending |
| SS-02 | Select a window source | The selected application window is previewed and no other source is captured. | Pending | Pending | Pending |
| SS-03 | Select a screen source | The selected display is previewed; multi-display identity is understandable. | Pending | Pending | Pending |
| SS-04 | Start capture | Local preview starts and the screen track is published once. | Pending | Pending | Pending |
| SS-05 | Remote playback | A second participant receives the shared track with usable resolution and motion. | Pending | Pending | Pending |
| SS-06 | Stop capture | Local preview and remote track stop; camera/microphone state is unchanged. | Pending | Pending | Pending |
| SS-07 | Leave room while sharing | Screen capture stops and the published track is cleaned up. | Pending | Pending | Pending |
| SS-08 | Permission denied | Picom remains stable and shows actionable, non-technical permission guidance. | Pending | Pending | Pending |
| SS-09 | Network interruption | Reconnect does not duplicate the screen track or leave stale sharing state. | Pending | Pending | Pending |
| SS-10 | Repeated start/stop | Three consecutive cycles succeed without duplicate sources or obvious resource growth. | Pending | Pending | Pending |

For every row, record `Pass`, `Fail`, `Blocked`, or `Not applicable`, plus an evidence reference and issue link when applicable.

## Windows certification notes

- Test supported Windows 10 and Windows 11 builds.
- Test a single monitor and at least one multi-monitor arrangement.
- For multi-monitor testing, include different scaling factors where available, such as 100%, 125%, and 150%.
- Move Picom between displays before opening the source picker and verify source labels/thumbnails remain understandable.
- Verify maximize/restore and the custom titlebar remain functional while sharing.
- Treat protected or hardware-overlay video appearing black as an operating-system/content limitation; Picom must still fail safely and must not misreport another source.
- Confirm stopping a share removes the Windows capture indicator where the OS provides one.

## Linux certification notes

- Record distribution, desktop environment, and display server for every result.
- Test X11 where supported.
- Test Wayland with PipeWire and a working `xdg-desktop-portal` implementation where supported by the distribution.
- On Wayland, the system portal may provide the final source picker rather than Electron. This is expected.
- If the portal, PipeWire, or desktop integration is missing, report the environment as blocked and show actionable guidance rather than silently failing.
- Verify window capture and full-display capture separately because compositor support differs.
- Confirm AppImage and native package sandbox/permission behavior for release formats that are shipped.

## macOS certification notes

- Test a supported macOS release on Apple silicon; add Intel coverage if an Intel artifact is shipped.
- Verify the first denied attempt gives clear guidance to open **System Settings > Privacy & Security > Screen Recording**.
- After granting Screen Recording access, fully quit and reopen Picom before retesting when macOS requires it.
- Confirm the app identity shown in System Settings matches the packaged Picom application.
- Test one display and multiple displays where hardware is available.
- Verify source selection, start, stop, and remote playback after permission is granted.
- A denied permission must map to the safe `VOICE_PERMISSION_DENIED` state; raw native errors must remain in redacted diagnostics only.

## Quality observations

For SS-04 and SS-05, record:

- Time from confirmation to local preview.
- Time from publish to remote playback.
- Whether the shared content is readable at normal window size.
- Frame freezes, excessive latency, or unexpected resolution changes.
- CPU and memory observations during a five-minute share.
- Whether audio remains stable for all participants.

No fixed production thresholds are claimed yet. Release candidates should be compared with the previous accepted build, and significant regressions block certification until reviewed.

## Evidence template

```text
Test ID:
Result: Pass | Fail | Blocked | Not applicable
Tester:
Date:
Picom version/commit:
Artifact type:
Platform and OS version:
CPU architecture:
Display server / desktop environment (Linux):
Monitor count and scaling:
Electron version:
LiveKit environment:
Observed result:
Redacted evidence reference:
Issue reference:
```

Evidence must not contain authentication tokens, private messages, personal desktop content, or production room credentials.

## Release pass criteria

- All applicable SS-01 through SS-08 scenarios pass on every shipped platform.
- SS-09 and SS-10 pass or have an explicitly accepted non-blocking limitation.
- No renderer crash, preload bridge error, duplicate published track, or capture resource leak is observed.
- Permission-denied states are actionable and do not expose raw technical errors.
- Known platform limitations are documented in release notes.
- Any blocked platform prevents claiming cross-platform screen-share certification for that platform.

## Current limitations and follow-up

- This document prepares certification; it does not claim that physical Windows, Linux, and macOS certification has been completed.
- Linux behavior depends on compositor, PipeWire, and portal support.
- macOS Screen Recording permission requires packaged-app testing.
- Multi-monitor and mixed-DPI behavior requires physical hardware verification.
- Automated smoke coverage can validate service state transitions, but remote visual quality still requires two-client manual testing.

