# Task 090 - ImagePreviewModal

Picom now has a dedicated `ImagePreviewModal` component for full-size image previews.

## Runtime path

- `src/components/ImagePreviewModal.tsx`
- Used by `src/App.tsx`

## Behavior

- Opens from `AttachmentGrid` image clicks.
- Shows the selected image and alt text caption.
- Closes on Escape, outside click, or close button.
- Uses the approved app icon system for the close icon.
- Keeps modal styling token-based through existing CSS classes.

## Manual verification

1. Start the app.
2. Click a message image attachment.
3. Confirm the image preview modal opens.
4. Close it with Escape.
5. Open again and close via outside click and close button.
6. Toggle light/dark mode and confirm modal remains polished.
