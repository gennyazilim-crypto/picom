# Task 084 - MemberSidebar toggle from ChatHeader

The member sidebar toggle is wired through `ChatHeader` and backed by persisted local member-sidebar state.

## Behavior

- Button hides and shows the right MemberSidebar.
- Active visual state reflects sidebar visibility.
- `aria-pressed` communicates the toggle state.
- Dynamic labels describe the next action: hide or show member sidebar.
- Visibility is persisted by `useMemberSidebarState`.

## Manual verification

1. Start the app.
2. Click the members icon in ChatHeader.
3. Confirm MemberSidebar disappears and ChatMain expands without horizontal overflow.
4. Click again and confirm MemberSidebar returns.
5. Reload and confirm the last visibility state is restored.
