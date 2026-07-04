# Task 095 - Member search

MemberSidebar search is now a more complete local MVP search.

## Runtime path

- `src/components/MemberSidebar.tsx`

## Search fields

- Display name
- Username
- Status text
- Status value
- Role name

## Behavior

- Uses `useDeferredValue` so typing remains smooth with larger mock member lists.
- Search is applied before grouping.
- Empty state includes the current query.
- Input has an accessible label.

## Manual verification

1. Start the app.
2. Search for a member display name.
3. Search for `admin`, `moderator`, `offline`, or a status text fragment.
4. Confirm member groups update and counts stay correct.
5. Clear the input and confirm all groups return.
