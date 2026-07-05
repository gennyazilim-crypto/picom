# MemberSidebar virtualization plan

Picom's current `MemberSidebar` renders grouped members inside an independent sidebar scroll container. This works for MVP-sized communities and keeps the premium desktop layout stable. Large communities will need virtualization later, but the implementation must preserve grouped headings, search behavior, presence updates, profile popovers, and context menus.

## Current behavior

Source:

- `src/components/MemberSidebar.tsx`
- `src/components/MemberGroup.tsx`
- `src/styles.css`

Current guarantees:

- MemberSidebar width remains fixed at 280px.
- `.member-list` owns independent scrolling.
- Search uses `useDeferredValue()` to avoid immediate filtering pressure on every key stroke.
- Filtered members are grouped with `useMemo()`.
- Groups are:
  - Admins
  - Moderators
  - Participants
  - Offline
- Member rows open profile actions and context menus.
- Presence/status dots remain token-driven and accessible.

## Why full virtualization is deferred

Full virtualization is not enabled in Task 413 because MemberSidebar has behavior that depends on stable rows:

- group headers with counts
- profile popover anchor clicks
- right-click context menus
- presence changes from Supabase Realtime
- local search filtering
- role badges and status text truncation

A naive virtual list could cause:

- group headers losing count/context
- popovers opening from unmounted rows
- context menu target drift
- presence updates rerendering large windows
- broken keyboard/focus behavior

No large virtualization dependency is added in this task.

## Future architecture

Preferred future approach:

1. Keep `MemberSidebar` as the public component API.
2. Flatten grouped members into a stable row model.
3. Use a fixed-height virtualizer only after row height is locked.
4. Keep group headers as virtual rows.
5. Keep profile popover/context menu payload data independent from DOM row lifetime.
6. Debounce or defer search before recalculating row windows.
7. Batch presence updates so one status change does not rerender the entire list.

## Row model

```ts
type MemberSidebarRow =
  | { type: "groupHeader"; id: string; label: string; count: number }
  | { type: "member"; id: string; memberId: string };
```

This structure allows future virtualization without changing the visible grouping model.

## Performance targets

Future runtime virtualization should support:

- 500 members with no visible lag
- 2,000 members with virtualization enabled
- search feedback within one animation frame after debounce/defer
- presence updates without rebuilding unaffected rows
- stable profile popover and context menu interactions
- no horizontal overflow at the 1100px minimum desktop width

## Manual QA checklist

Before enabling runtime virtualization:

- Load a mock community with 500+ members.
- Confirm Admins, Moderators, Participants, and Offline groups render correctly.
- Search by display name, username, role, and status text.
- Confirm no overflow in long Turkish/English names.
- Click member rows and confirm full profile/popover behavior still works.
- Right-click member rows and confirm context menus stay within bounds.
- Simulate presence changes and confirm only affected visible rows update.
- Hide/show MemberSidebar from ChatHeader and confirm ChatMain remains stable.

## Current decision

For Task 413, Picom keeps the current non-virtualized MemberSidebar runtime. The existing deferred search and memoized grouping are safe to keep; full virtualization is deferred until a focused performance implementation.
