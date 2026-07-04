# Task 091 - MessageComposer

Picom now has a dedicated `MessageComposer` component for the pinned message input area.

## Runtime path

- `src/components/MessageComposer.tsx`
- Used by `src/components/ChatMain.tsx`

## Behavior

- Textarea for local message text.
- Enter sends, Shift+Enter adds a newline.
- Empty messages cannot be sent unless image previews exist.
- Local image previews can be added by drag/drop or paste.
- Invalid files show toast feedback through the existing file service.
- Composer remains outside the message list so it stays pinned at the bottom.

## Manual verification

1. Start the app.
2. Type a message and press Enter.
3. Confirm the message appears locally.
4. Press Shift+Enter and confirm a newline is inserted.
5. Paste or drag an image and confirm the preview appears.
6. Remove the preview and confirm the composer remains stable.
