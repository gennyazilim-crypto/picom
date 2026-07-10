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

## Final stack rules

- Opening Settings, command palette, a context menu, profile preview, or image preview closes conflicting transient layers first.
- Blocking modals managed by independent feature state trigger App-level transient cleanup before interaction.
- Blocking dialogs use the shared focus trap. Escape closes only the topmost `aria-modal=true` dialog, Tab stays within it, and focus restoration returns to the opener where practical.
- Context menus and profile popovers retain their own lightweight keyboard/outside-click behavior and restore focus after close.
- Context menus/profile popovers use the shared four-edge viewport clamp.
- Image preview and story viewer are blocking dialogs and use the same topmost focus contract.
- `html`, `body`, and `#root` remain page-scroll locked; blocking fixed backdrops prevent pointer interaction with desktop panes while each pane keeps its own approved scroll container.
- Toasts are non-blocking and do not enter the Escape stack.

This is a structural local-state manager rather than a general plugin/runtime overlay system. Feature modules must not add arbitrary document-level Escape listeners for new blocking modals; use `useDialogFocusTrap` instead.

## Manual verification

1. Open settings from the rail or `Ctrl + ,`.
2. Open command palette with `Ctrl + K`.
3. Right-click a channel/message/member to open a context menu.
4. Click a member or message avatar to open the profile popover.
5. Click an image attachment to open image preview.
6. Open a context menu/profile preview, then open Settings or image preview and confirm the earlier transient layer closes.
7. Open a blocking modal and press `Escape`; confirm only the topmost modal closes and focus returns to its opener.
8. Tab/Shift+Tab through Settings, story viewer, image preview, report, channel/community, poll and community access modals.
9. Place context menus/profile popovers near all four viewport edges and confirm they remain in bounds.
10. Scroll the underlying chat/feed while a blocking modal is open and confirm background scroll does not move.
11. Confirm toast notifications remain visible/non-blocking and do not consume Escape.

## Manual release check

Run the sequence in normal and maximized windows, light/dark themes, and at the supported minimum 1100x700 size. Native permission dialogs remain OS-owned and require separate packaged-app testing.
