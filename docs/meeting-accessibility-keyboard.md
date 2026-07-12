# Meeting accessibility, keyboard, and reduced motion

## Scope

Picom's meeting workspace keeps accessibility behavior in the meeting renderer layer. It does not change global application shortcuts or native Electron controls.

## Focus order and navigation

- Focus-only skip links move directly to the media stage, control dock, or open side panel.
- Stage, dock, and panel targets use `tabIndex=-1`; they are programmatically focusable without adding an extra ordinary tab stop.
- The visible order remains top bar, meeting stage, side panel, then control dock.
- Closing the side panel from inside it returns focus to the top-bar panel toggle.
- Participant context menus remember their invoking tile/action button and restore focus when closed.
- Destructive host dialogs use the shared dialog focus trap, support Escape, and restore prior focus.
- Meeting control menus focus their first enabled option, support Up, Down, Home, and End, and restore their trigger on Escape or selection.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `M` | Toggle microphone through the existing control |
| `V` | Toggle camera through the existing control |
| `S` | Open the existing screen-share picker or stop sharing |
| `H` | Raise/lower hand or request/cancel stage access |
| `C` | Open the Chat panel |
| `P` | Open the People panel |
| `L` | Cycle permitted meeting layouts |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Focus Leave; Enter remains required |
| `?` | Announce the shortcut summary |

Plain-letter shortcuts are disabled while focus is in an input, textarea, select, editable region, or ARIA textbox. All meeting shortcuts pause while a modal or menu is open. Repeated keydown events and unrelated modifier combinations are ignored. Shortcuts invoke existing UI controls rather than bypassing permission, device, screen-source, or error handling.

## Screen-reader contract

- Connection phase is a live status with text, not only a colored dot.
- Participant labels include role, speaking, microphone, camera, raised hand, screen share, connection quality, and presence.
- Media privacy state, device errors, waiting-room state, and meeting errors expose text status.
- Verification remains a separate approved identity signal; role and online/media state never imply verification.
- Keyboard actions use a polite atomic live region.

## Captions and motion

- Caption display can be shown/hidden and typography can be selected as small, medium, or large.
- `prefers-reduced-motion: reduce` removes reaction animation and meeting stage/layout/menu transitions and disables smooth scrolling.
- Media publication and caption capture behavior are unchanged by visual motion preferences.

## Contrast and targets

Meeting controls use semantic surface, border, text, focus, warning, success, and danger tokens. Primary control targets are at least 34px high; the media controls remain 54px. Focus is communicated with the focus token and outline, while speaking, hand, role, connection, and media states retain text or accessible labels so color is never the only signal.

## Evidence limits

The structural smoke verifies source contracts. Final release evidence still requires keyboard-only traversal plus NVDA on Windows, Orca on Linux, and VoiceOver on macOS on native builds. Those platform runs must be recorded rather than inferred from source inspection.
