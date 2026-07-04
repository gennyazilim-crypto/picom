# Task 089 - AttachmentGrid

Picom now has a dedicated `AttachmentGrid` component for image attachment previews.

## Runtime path

- `src/components/AttachmentGrid.tsx`
- Used by `src/components/MessageItem.tsx`

## Behavior

- Supports the existing 1, 2, 3, and 4 image layout classes.
- Limits visible attachment previews to four images.
- Uses lazy image loading.
- Opens the existing image preview modal through `onOpenImage`.
- Keeps images inside the message column without horizontal overflow.

## Manual verification

1. Start the app.
2. Find mock messages with 1, 2, 3, and 4 attachments.
3. Confirm each layout stays inside the chat column.
4. Click an image and confirm the preview modal opens.
5. Toggle light/dark mode and confirm attachment cards remain polished.
