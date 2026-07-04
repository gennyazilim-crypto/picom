# Task 172 Checkpoint - Persist Attachment Metadata

## Completed

- Added `attachmentService` with typed metadata result/error shapes.
- Added mock-mode metadata persistence fallback.
- Added Supabase-mode insert into the `attachments` table.
- Extended upload summaries with the uploading user id.
- Wired `MessageComposer` to persist metadata after upload and before local message creation.

## Validation

Run:

```powershell
npm run typecheck
npm run build
```

## Follow-up

- Link persisted pending attachment rows to the backend message id when API-backed message creation owns attachment persistence end-to-end.
- Add attachment status update from `pending` to `attached` in the backend/API path.