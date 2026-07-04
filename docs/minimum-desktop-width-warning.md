# Minimum desktop width warning

Picom is a desktop-only chat app. The MVP shell keeps the 4-column layout stable instead of introducing a mobile layout.

## Behavior

- At widths below 1100px, the app hides the main desktop shell.
- A polished desktop warning appears instead: "This app is optimized for desktop."
- The message tells the user to resize the window to at least 1100px wide.
- No bottom navigation, mobile breakpoint, or web-first responsive layout is introduced.

## Manual verification

- Launch Picom normally.
- Resize the window below 1100px wide.
- Confirm the warning appears.
- Resize back above 1100px and confirm the 4-column desktop layout returns.