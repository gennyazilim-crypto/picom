# Electron Window Controls Manual Smoke Checklist

Use this checklist in Electron, not a browser-only Vite tab.

## Development window

1. Run `npm run electron:dev`.
2. Confirm no native File/Edit/View menu or duplicate titlebar appears.
3. Drag the window using an empty titlebar area.
4. Click Search and confirm it opens without moving the window.
5. Toggle the theme and confirm the click does not begin a drag.
6. Click Minimize and restore Picom from the taskbar/dock.
7. Click Maximize and confirm the frame becomes flush, the button label/state changes to Restore, and the app does not enter fullscreen.
8. Click Restore and confirm the previous normal bounds return.
9. Click Close and confirm normal close-to-tray preference is respected; with close-to-tray disabled, the window closes.
10. Repeat maximize/restore rapidly and confirm no duplicate action or stale titlebar state.

## Packaged Windows smoke

1. Install or start the current internal package in an isolated user-data profile.
2. Repeat minimize, maximize, restore, close, drag, Search, theme, and notification checks.
3. Confirm the native menu remains hidden and no black top band appears.
4. Confirm window controls remain usable at 1100x700 and 1440x900.

## Accessibility

- Tab to Search, notification, theme, minimize, maximize/restore, and close.
- Confirm focus rings appear only under keyboard focus.
- Confirm labels announce Minimize window, Maximize window/Restore window, and Close window.
- Confirm the maximize button exposes pressed state.

Record OS, package/dev mode, result, timestamp, and any diagnostics ID. Do not include local secrets or raw tokens.

