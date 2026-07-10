# Keyboard shortcuts customization

Picom stores custom shortcut labels locally under `picom:keyboard-shortcuts:v1`; no account, message, token, or other sensitive data is included. The service normalizes keyboard events for Windows/Linux `Ctrl`, macOS `Cmd`, and shared `Alt` combinations.

## Safety rules

- A configurable shortcut requires `Ctrl`, `Cmd`, or `Alt` plus another key.
- Duplicate bindings are rejected with the conflicting action name.
- OS and Chromium-reserved combinations such as `Alt+F4`, `Ctrl/Cmd+W`, `Ctrl+R`, `Ctrl+Shift+I`, and `Cmd+Q` cannot be assigned.
- `Escape` remains fixed so dialogs and overlays always retain a reliable close path.
- Global actions do not run while focus is in an input, text area, select, or editable region.
- Reset defaults restores the shipped bindings without changing other Picom settings.

Settings > Keyboard Shortcuts provides local editing and reset controls. Native/global OS shortcuts remain out of scope; Picom listens only while its renderer is focused.
