# Media upload UX v2

Picom's message composer uses the existing validated image-upload pipeline and exposes one local state machine per attachment: `pending`, `uploading`, `uploaded`, `failed`, or `canceled`.

## User behavior

- Progress is shown while validation, upload, and metadata creation run. It is a bounded stage indicator, not a claim of exact network bytes transferred by Supabase Storage.
- An active upload can be canceled through its close control. The existing `AbortController` stops mock uploads immediately and prevents canceled results from being attached to a message.
- Failed and canceled items offer both **Retry** and **Remove**. Retry creates a fresh controller and reruns all validation; Remove revokes the local object URL.
- Sending waits for every attachment to reach `uploaded`. A failed or canceled item must be retried or removed.
- Changing channel/community or unmounting the composer aborts active work and revokes every preview URL.

## Safety boundaries

- Only PNG, JPEG, WebP, and GIF images accepted by `fileService` are eligible.
- File size, declared MIME type, and content signature are validated before storage upload.
- Supabase uses the existing private `message-attachments` bucket path, `upsert: false`, RLS/storage policies, pending metadata, scan status, and quarantine flow.
- Cancel/retry does not bypass validation, malware scanning placeholders, authorization, or storage rules.
- Logs contain safe type/size/error-code metadata only, never file contents, tokens, or storage credentials.

## Manual error checks

1. Add a supported image and send; verify progress reaches Uploaded before the message is sent.
2. Cancel during mock upload; verify the item becomes Canceled and the message is not sent.
3. Retry the canceled item; verify it returns to Uploading and can complete.
4. Remove a failed/canceled item; verify the card disappears and other draft content remains.
5. Try an unsupported extension, a mismatched image signature, and an oversized file; verify each is rejected before upload.
6. Switch channels during upload; verify no stale preview or upload result appears in the new channel.
7. Repeat in Supabase mode with an unauthorized bucket policy; verify a concise failure state and no raw backend error.

## Automated checks

- `npm run upload:ux:test`
- `npm run attachment-delivery:smoke`
- `npm run attachments:scan:smoke`
- `npm run attachments:quarantine:smoke`
