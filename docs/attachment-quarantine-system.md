# Attachment Quarantine System

Picom now has a client-side quarantine decision layer that blocks suspicious or failed attachments from rendering as normal image previews. This is a foundation for a future backend quarantine review workflow.

## Current foundation

- Service: `src/services/attachmentQuarantineService.ts`
- Scan source: `Attachment.scanStatus`
- UI enforcement: `AttachmentGrid`
- Admin placeholder: `AdminOperationsPanel`

## Quarantined states

The quarantine service treats these scan states as quarantined:

- `suspicious`
- `failed`

These attachments are not rendered as normal images and instead show a blocked state.

## Non-quarantine blocked states

`pending` attachments are also blocked from normal rendering, but they are not marked as quarantined. They should remain unavailable until a scanner marks them clean or skipped in development.

## Prepared admin routes

These routes are documented placeholders only. They are not public runtime endpoints in this task.

```text
GET /admin/attachments/quarantine
PATCH /admin/attachments/:attachmentId/review
```

Production implementation must require app-admin or trusted safety operator authorization and must not expose secrets, raw tokens, or raw storage paths to normal users.

## Renderer behavior

- Clean/development-skipped attachments render normally.
- Pending attachments show unavailable state.
- Suspicious/failed attachments show “Attachment blocked for safety”.
- Blocked attachments do not call `onOpenImage` and do not open `ImagePreviewModal` from the grid.

## Storage behavior required later

A production backend/storage layer must enforce this server-side too:

- Suspicious or failed files should not receive public URLs.
- Signed URLs must not be issued for quarantined files.
- CDN caches must be purged or versioned if an attachment becomes quarantined after initial availability.
- Normal users must not access quarantined objects directly.

## Manual test steps

1. Run the app in mock mode and confirm normal image attachments still render.
2. Temporarily set a test attachment to `scanStatus: "suspicious"`.
3. Confirm the grid shows a blocked attachment card.
4. Confirm clicking the blocked card does not open the image preview.
5. Open Settings > Advanced in development and confirm Admin Operations shows the quarantine placeholder summary.

## Remaining work

- Persist `scan_status`/quarantine status in Supabase when backend scanner integration is chosen.
- Implement the admin review routes with strict app-admin authorization.
- Add audit logs for quarantine release/block actions.
- Add storage/Edge Function enforcement so UI is not the only protection.
