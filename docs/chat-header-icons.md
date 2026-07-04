# ChatHeader icon mapping

Task 055 confirms ChatHeader icons are rendered through `AppIcon` and backed by the MVP semantic icon map.

## Mapped icons

- Channel type icon: text/voice channel semantic icons
- Pinned: `chatHeader.pinned`
- Notifications: `chatHeader.notifications`
- Inbox: `chatHeader.inbox`
- Member sidebar toggle: `chatHeader.members`
- Search: `chatHeader.search`
- More: `chatHeader.more`

## Accessibility

ChatHeader action buttons keep explicit `aria-label` values. The channel title includes visible text, so the channel type icon remains decorative.