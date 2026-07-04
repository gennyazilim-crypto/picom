# Composer Attachment Preview

Task 170 completes the MVP composer image attachment preview flow.

## Behavior

- Attach button opens the native file picker.
- File picker accepts PNG, JPEG, WEBP, and GIF images.
- Drag/drop and paste image attachment flows remain supported.
- Up to four image previews are shown in the composer.
- Removing a preview revokes its local object URL.
- Extra previews beyond the four-item limit are revoked immediately.

## Notes

Sent local attachment object URLs are kept alive so the just-sent mock message can still render its image preview. A future upload lifecycle task can replace local object URLs with Supabase Storage URLs and safely revoke local previews after upload confirmation.

## Manual verification

1. Click the composer attach button.
2. Select one or more allowed images.
3. Confirm previews appear below the composer.
4. Remove a preview and confirm the UI updates.
5. Send a message with an image and confirm it renders in MessageList.
6. Drag/drop and paste images to confirm existing paths still work.