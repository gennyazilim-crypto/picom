# Desktop Display Scaling QA

## Status

Automated structural checks are complete. **Physical manual hardware status: pending** for the release candidate. This document does not claim that 125%/150% scaling, mixed-DPI monitor movement or all compositors were visually executed in the current coding environment.

Picom remains a Windows, Linux and macOS Electron desktop app. **No mobile UI**, mobile navigation or web-first responsive layout is introduced.

## Automated contract

Run:

```powershell
npm run desktop:display:qa
npm run desktop:smoke
npm run visual:regression:contract
npm run packaging:smoke
```

The contract verifies:

- default BrowserWindow size is 1440x900 and minimum size is 1100x700;
- persisted window state is accepted only when at least 120 device-independent pixels remain visible on a current display work area;
- maximize/unmaximize state reaches the renderer and switches normal/maximized frame styling;
- context menus and profile popovers clamp against left, top, right and bottom viewport edges;
- desktop shell, modal viewport bounds and no-mobile source policy remain present;
- deterministic 1440x900 light/dark visual scenarios remain declared.

## Physical QA matrix

Record OS, desktop environment/compositor, GPU, Electron build, display arrangement, scale and result. Use synthetic Picom data only.

| Platform | Resolution | Scale | Window state | Required checks | Status |
| --- | --- | --- | --- | --- | --- |
| Windows | 1920x1080 | 100% | normal/maximized | four columns, titlebar, overlays, composer | Pending |
| Windows | 1920x1080 | 125% | normal/maximized | truncation, modal bounds, drag/controls | Pending |
| Windows | 2560x1440 | 150% | normal/maximized | text/icon sharpness, independent scroll | Pending |
| Windows | ultrawide | 100%/125% | normal/maximized | center growth, no stretched fixed rails | Pending |
| Linux | 1920x1080 | 100% | normal/maximized | X11/Wayland approved matrix | Pending |
| Linux | 2560x1440 | 125%/150% | normal/maximized | fractional scaling/compositor behavior | Pending |
| macOS | approved Retina display | default/scaled | normal/maximized | titlebar controls, sharpness, overlays | Pending |

## Multi-monitor sequence

1. Start Picom on the primary monitor in normal mode.
2. Move it to a **secondary monitor** with the same scale; verify frame, menus and popovers remain within the work area.
3. Move between monitors with different DPI/scale; verify Chromium redraws text/icons without stale coordinates or clipping.
4. Maximize, restore and drag again; verify outer padding/radius returns only in normal mode.
5. Place the window near every display edge and open context menus, profile popovers, Settings, create/edit/delete modals, image preview, story viewer and command palette.
6. Disconnect the secondary display while Picom is closed, then relaunch; verify off-screen persisted state falls back to the default visible placement.
7. Reconnect/reorder displays and repeat with negative virtual desktop coordinates.

## Layout checklist

- ServerRail remains 72px, CommunitySidebar 260px and MemberSidebar 280px in CSS pixels.
- ChatMain receives remaining width with `min-width: 0`; no page-level horizontal overflow appears.
- Composer remains pinned and MessageList scrolls independently.
- At 1100x700 all critical titlebar and chat controls remain reachable.
- Below the supported width, the desktop warning appears; Picom does not switch to a mobile layout.
- Maximized mode removes outer padding, radius and large shadow; restore returns the premium floating frame.
- Long Turkish/English labels truncate or wrap without hiding critical actions/counts.

## Overlay and modal checklist

- Context menus and popovers stay at least their configured margin from all viewport edges.
- Blocking modals fit within the viewport and their internal content scrolls where needed.
- Settings, report, channel/community, poll, profile/story and image surfaces remain closable with keyboard.
- Native permission dialogs are OS-owned and must be tested separately.

## Evidence and release gate

For each matrix row attach a redacted screenshot/reference, result, reviewer and issue IDs. Stable release requires no blocker/high clipping, unreachable window control, off-screen restore, overlay escape or horizontal desktop-shell overflow. The existing visual-regression contract is not pixel-diff evidence; Playwright baselines remain separately gated.

