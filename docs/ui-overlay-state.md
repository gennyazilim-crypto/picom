# Task 070 - UI overlay state

Picom now has a small local overlay state hook for the MVP desktop shell.

## Scope

- Settings modal open/close state.
- Command palette open/close and keyboard selection state.
- Desktop context menu state.
- User profile popover state.
- Image preview modal state.
- Toast queue state.

## Implementation path

- Runtime hook: `src/state/useOverlayState.ts`
- App wiring: `src/App.tsx`

The hook keeps overlay behavior local and mock-friendly without adding a global state dependency. It is intentionally small so future backend work can be added without changing the desktop layout.

## Manual verification

1. Open settings from the rail or `Ctrl + ,`.
2. Open command palette with `Ctrl + K`.
3. Right-click a channel/message/member to open a context menu.
4. Click a member or message avatar to open the profile popover.
5. Click an image attachment to open image preview.
6. Press `Escape` to close transient overlays.
