# Task 099 - Keyboard Shortcuts section

Picom now has a dedicated `KeyboardShortcutsSection` component inside Settings.

## Runtime path

- `src/components/KeyboardShortcutsSection.tsx`
- Used by `src/components/SettingsModal.tsx`

## Behavior

- Lists MVP desktop shortcuts from `shortcutService`.
- Keeps shortcut rendering inside the existing settings modal visual style.
- Does not add shortcut editing yet.
- Keeps Windows/Linux/macOS desktop keyboard-first behavior visible to users.

## Manual verification

1. Open Settings.
2. Select Keyboard Shortcuts.
3. Confirm shortcuts render in a compact list.
4. Test Ctrl+K, Ctrl+, Alt+Up, Alt+Down, and Escape in the app shell.
