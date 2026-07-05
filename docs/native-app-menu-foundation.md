# Native App Menu Foundation

Picom keeps the operating-system application menu hidden during the MVP so the custom desktop titlebar remains the only visible chrome.

## Current behavior

- Electron calls `Menu.setApplicationMenu(null)`.
- The BrowserWindow uses `autoHideMenuBar: true`.
- The custom Picom titlebar owns visible app actions.
- Renderer code does not call Electron menu APIs directly.

## Menu action service

`menuService` is the renderer-side foundation for future app menu actions. It exposes typed placeholder actions for:

- Open Settings
- Open Command Palette
- Open Mention Feed
- Open Direct Messages
- Open Friends
- Open Help placeholder
- Open About placeholder
- Send Feedback placeholder
- Export Diagnostics
- Quit placeholder

## Safety rules

- Do not re-enable a visible File/Edit/View/Window menu for the MVP.
- Keep Electron objects behind preload/native services.
- Use typed action names instead of arbitrary command strings.
- Keep diagnostics export redacted through `feedbackService` and `loggingService`.
- Keep quit behavior behind native window/tray controls until a production app menu is intentionally designed.

## Test checklist

- Start Electron dev mode.
- Confirm no native File/Edit/View/Window menu is visible.
- Open Settings > Advanced.
- Use the app menu simulation buttons.
- Confirm Command Palette opens from the simulated menu action.
- Confirm diagnostics export uses the existing safe file flow.
- Confirm the custom titlebar and four-column layout remain unchanged.
