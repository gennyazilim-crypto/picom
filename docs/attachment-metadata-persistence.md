# Attachment Metadata Persistence

Task 172 prepares attachment metadata persistence for the Picom MVP upload flow.

## Scope

- Image files are still uploaded through `uploadService`.
- After a successful upload, `attachmentService.createPendingAttachmentMetadata()` stores a pending attachment row.
- The message composer uses the persisted attachment id when creating the local message attachment payload.
- Mock mode returns deterministic safe metadata without requiring Supabase.
- Supabase mode writes to the `attachments` table with a `pending` status.

## Current behavior

1. User selects an image in the desktop message composer.
2. The image is previewed locally.
3. On send, each image uploads through the centralized upload service.
4. Upload metadata is persisted as a pending attachment.
5. The local message displays the image attachment immediately after send.

## Notes

- This task does not yet attach metadata rows to a saved backend message id.
- A later task can update pending rows to `attached` once message persistence and attachment linking are fully wired.
- No service-role keys or secrets are used in the renderer.
- React components do not call Supabase directly.