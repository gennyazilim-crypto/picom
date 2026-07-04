# Task 098 - SettingsModal MVP

Picom now has a dedicated `SettingsModal` component for MVP desktop settings.

## Runtime path

- `src/components/SettingsModal.tsx`
- Used by `src/App.tsx`

## MVP sections

- Account placeholder
- Profile placeholder
- Appearance
- Notifications placeholder
- Voice & Video placeholder
- Keyboard Shortcuts
- Advanced placeholder

## Behavior

- Appearance switches light/dark theme.
- Notifications can trigger the safe notification test placeholder.
- Keyboard Shortcuts lists local shortcut bindings.
- Advanced can simulate the tray settings action through the tray service abstraction.
- Closes on Escape, close button, or backdrop click.

## Manual verification

1. Open Settings from the rail or user mini card.
2. Switch between all left-nav sections.
3. Toggle light/dark theme.
4. Send a notification placeholder.
5. Simulate tray settings from Advanced.
6. Close with Escape and close button.
