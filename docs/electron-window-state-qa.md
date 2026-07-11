# Electron Window State and Frame QA

## Status

Automated state/frame contracts and a Windows 100% single-monitor package smoke are complete. Physical 125% and 150% DPI tests and real multi-monitor movement are **BLOCKED** because the current host exposes one 1920x1080 display at 96 DPI. This document does not convert unavailable hardware evidence into a pass.

## Automated contract

Run:

```powershell
npm run electron:window-state:qa
npm run electron:window-controls:test
npm run desktop:display:qa
npm run electron:security:smoke
npm run packaging:smoke
```

The contract protects:

- frameless, opaque BrowserWindow creation with native menus disabled;
- 1440x900 defaults and 1100x700 minimum bounds;
- safe persisted bounds that retain at least 120 device-independent pixels on an active display work area;
- maximize/unmaximize events reaching both the shell and custom titlebar;
- normal frame backdrop, radius, border, and shadow;
- maximized removal of outer padding, corner radius, and large shadow;
- root clipping, tokenized background painting, titlebar drag, interactive no-drag, and focus-visible behavior;
- fail-closed window controls when the preload bridge is unavailable.

## Current host evidence

| Check | Evidence | Result |
| --- | --- | --- |
| Host display | `DISPLAY1`, 1920x1080, work area 1920x1032 | PASS |
| Scale | 96 DPI / 100% | PASS |
| Monitor topology | one primary monitor | PASS for single-monitor only |
| 125% scale | matching host mode unavailable | BLOCKED |
| 150% scale | matching host mode unavailable | BLOCKED |
| multi-monitor movement | second physical display unavailable | BLOCKED |

Task 433 live automation exercised the same custom titlebar and safe preload bridge in development and `win-unpacked`. Minimize, maximize, restore, theme, search, and packaged close passed. Task 434 adds state/frame assertions and the repeatable manual matrix below.

## State matrix

### Normal

1. Launch Picom in a restored window.
2. Confirm the soft backdrop surrounds the app frame without a black or transparent gap.
3. Confirm the frame has its tokenized radius, subtle border, and app shadow.
4. Resize from every edge; confirm the four-column layout remains clipped inside BrowserWindow bounds and the composer stays pinned.

### Maximized

1. Use the custom maximize button.
2. Confirm the button label changes to `Restore window` and the root reports `data-window-state="maximized"`.
3. Confirm outer padding, frame radius, and large shadow are removed.
4. Confirm content reaches the available work-area edges without hiding the Windows taskbar or entering fullscreen.

### Restored and minimized

1. Restore with the custom control and confirm the floating frame returns.
2. Minimize and restore from the taskbar; confirm state styling remains synchronized.
3. Repeat after changing theme and after opening/closing command search.

### Drag and double-click

1. Drag only from empty titlebar/brand space.
2. Confirm search, theme, minimize, maximize, and close never drag the window.
3. Double-click empty titlebar space and confirm maximize/restore toggles without triggering controls below it.
4. Keyboard-tab through the titlebar and confirm focus appears only through `:focus-visible`.

### Fullscreen-adjacent behavior

Maximize is not fullscreen. Confirm the OS taskbar remains available, no fullscreen transition is triggered, and restoring returns the previous safe frame. Any future explicit fullscreen feature requires a separate state and QA path.

## Relaunch and off-screen recovery

1. Restore Picom to a non-maximized size and move it near a work-area edge.
2. Close normally and relaunch; verify the saved size/position remains visible and respects minimum bounds.
3. For an **off-screen recovery** test, close Picom on a secondary display, disconnect that display, then relaunch.
4. Confirm persisted bounds are rejected when fewer than 120 device-independent pixels intersect every current display work area.
5. Confirm Picom falls back to a visible default placement rather than rendering outside BrowserWindow bounds.

## DPI and multi-monitor matrix

| Platform | Scale/topology | Normal | Maximized | Restore | Drag/double-click | Relaunch | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Windows | 100%, single-monitor | tested | tested | tested | structural/manual follow-up | tested package startup | PASS with pointer follow-up |
| Windows | 125%, single-monitor | required | required | required | required | required | BLOCKED |
| Windows | 150%, single-monitor | required | required | required | required | required | BLOCKED |
| Windows | mixed-DPI multi-monitor | required | required | required | required | off-screen recovery required | BLOCKED |
| Linux | X11 and approved Wayland compositor | required | required | required | required | required | BLOCKED pending native matrix |
| macOS | approved Retina/scaled modes | required | required | required | required | required | BLOCKED pending native matrix |

## Packaged smoke instructions

1. Run `npm run package:win:dir`.
2. Start `release/win-unpacked/Picom.exe` with a clean temporary user-data directory.
3. Execute the complete state matrix, including close and relaunch.
4. Repeat at 100%, 125%, and 150% after signing out/in if Windows requires it.
5. Record OS build, Electron version, GPU, display scale, monitor arrangement, screenshots, reviewer, and issue IDs.
6. Do not claim macOS/Linux or mixed-DPI certification from the Windows package result.

## Release gate

Any unreachable custom control, state-label mismatch, black/transparent gap, click-through, drag regression, off-screen relaunch, composer displacement, or horizontal overflow is a blocker. Hardware-dependent rows remain blocked until real evidence is attached.
