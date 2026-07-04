# Upload Image Before Sending Message

Task 171 routes composer image attachments through `uploadService` before sending the message.

## Behavior

- The composer keeps local image previews.
- On send, each preview file is uploaded first through `uploadService.uploadImageAttachment()`.
- If any upload fails, the message is not sent and a toast is shown.
- If uploads succeed, the message is sent with the existing local preview attachments.
- Mock mode remains backend-free because `uploadService` returns a mock upload summary.

## Current limitation

Attachment metadata rows are not created in this task. Local preview URLs are still used for immediate MVP rendering. A later task should replace local preview URLs with Supabase storage/signed URLs after metadata is connected.

## Manual verification

1. Attach an image in mock mode.
2. Send the message.
3. Confirm the message appears with the image preview.
4. Try an invalid file and confirm it is rejected before send.
5. In Supabase mode, confirm upload failure blocks message send and shows a toast.