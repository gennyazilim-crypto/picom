# Task 083 - ChatHeader

Picom now has a dedicated `ChatHeader` component for the fixed top area of the chat column.

## Runtime path

- `src/components/ChatHeader.tsx`
- Used by `src/components/ChatMain.tsx`

## Behavior

- Shows active channel icon, name, and topic.
- Uses the approved app icon system for all header actions.
- Keeps member sidebar toggle behavior.
- Keeps pinned, notifications, inbox, search, and more as MVP placeholders.
- Reuses existing `chat-header`, `chat-title`, and `chat-actions` styles.

## Manual verification

1. Start the app.
2. Switch text channels and confirm the header name/topic updates.
3. Switch voice placeholder channels and confirm the channel icon updates.
4. Click the member toggle and confirm MemberSidebar hides/shows.
5. Toggle light/dark mode and confirm header contrast remains polished.
