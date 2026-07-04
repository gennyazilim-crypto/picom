# Task 071 - Member sidebar visibility state

Picom now has a dedicated local state hook for the member sidebar.

## Runtime hook

- `src/state/useMemberSidebarState.ts`

## Behavior

- Tracks whether the right member sidebar is visible.
- Persists the preference in local storage.
- Fails safely if local storage is unavailable.
- Keeps the desktop layout stable by only toggling the existing fixed sidebar.

## Manual verification

1. Open the app.
2. Use the member-sidebar toggle in the chat header.
3. Confirm the right sidebar hides and the chat column expands.
4. Toggle again and confirm the member sidebar returns.
5. Reload the app and confirm the last visibility choice is restored.
