# MessageList virtualization plan

Picom's current `MessageList` renders all messages for the active channel in a single independent scroll container. This is acceptable for MVP mock data and small/medium channels, but large channels need virtualization before stable production scale.

## Current behavior

Source:

- `src/components/MessageList.tsx`
- `src/components/ChatMain.tsx`
- `src/styles.css`

Current guarantees:

- `ChatMain` keeps the composer pinned below the message list.
- `.message-list` owns independent vertical scrolling.
- The desktop frame does not page-scroll.
- Message search jump uses `data-message-id` and `scrollIntoView`.
- New local messages auto-scroll to the bottom.
- Typing indicator renders below the message rows.
- Attachment grids can use variable heights.
- Blocked-user placeholders, unread divider, editing rows, reactions, and replies all render inline.

## Why full virtualization is deferred

Full virtualization is not a safe one-file change because Picom messages have variable height:

- multiline text
- image attachment grids
- reply previews
- editing textareas
- reaction rows
- deleted-message placeholders
- blocked-user placeholders
- unread divider
- typing indicator
- highlighted search target

A naive fixed-row virtual list would risk:

- broken scroll-to-message behavior
- incorrect unread divider position
- attachment layout shift
- composer overlap
- lost keyboard/focus behavior during inline editing
- poor search/highlight behavior for messages outside the rendered range

No large virtualization dependency is added in this task.

## Future architecture

Preferred future approach:

1. Keep `MessageList` as the public component API.
2. Add an internal `VirtualizedMessageListBody` behind a feature flag.
3. Use a variable-height capable virtualizer only after dependency review.
4. Preserve `data-message-id` registration for search jump.
5. Keep typing indicator outside or as the final virtual row.
6. Keep unread divider as a virtual row with stable key.
7. Preserve scroll anchoring when older messages load.
8. Use reduced-motion settings for programmatic scrolling.

## Row model

Future row model should flatten message content into stable rows:

```ts
type MessageListRow =
  | { type: "unreadDivider"; id: string }
  | { type: "message"; id: string; messageId: string }
  | { type: "blockedMessage"; id: string; messageId: string }
  | { type: "typingIndicator"; id: string };
```

This keeps rendering decisions explicit and avoids mixing virtualization logic into message actions.

## Performance targets

The production implementation should support:

- 1,000 messages without visible input lag
- 5,000 messages with virtualization enabled
- stable scroll position when older messages load
- search jump to an unloaded message via message context load placeholder
- no horizontal overflow at 1100px minimum width
- composer remaining pinned at all times

## Manual QA checklist

Before enabling runtime virtualization:

- Render a channel with 1,000+ mock messages.
- Scroll from top to bottom and confirm no blank gaps.
- Send a message and confirm the list anchors to the bottom.
- Edit a message and confirm row height recalculates.
- Delete a message and confirm placeholder height remains stable.
- Add/remove reactions and confirm counts update without scroll jumps.
- Open image preview from attachments.
- Use message search jump and confirm highlighted message scrolls into view.
- Toggle reduced motion and confirm scroll animation is reduced.
- Verify light/dark mode, no horizontal overflow, and fixed sidebars.

## Current decision

For Task 412, Picom keeps the current non-virtualized MessageList runtime. The production path is documented so the future implementation can be done as a focused performance task instead of a risky layout refactor.
