# Task 396: Attachment Quarantine System

## Scope

Prepared attachment quarantine access decisions and blocked-state rendering for suspicious or failed scan results.

## Changed files

- `src/services/attachmentQuarantineService.ts`
- `src/components/AttachmentGrid.tsx`
- `src/components/AdminOperationsPanel.tsx`
- `docs/attachment-quarantine-system.md`
- `scripts/attachment-quarantine-smoke-test.mjs`
- `docs/task-checkpoints/task-396-attachment-quarantine-system.md`
- `package.json`

## Implementation notes

- `suspicious` and `failed` scan states are treated as quarantined.
- `pending` remains blocked from rendering but is not marked as quarantined.
- `AttachmentGrid` now uses the quarantine service before rendering image previews.
- Admin Operations shows a development-only quarantine summary placeholder.
- Backend admin routes are documented placeholders only.

## Verification commands

```bash
npm run attachments:quarantine:smoke
npm run attachments:scan:smoke
npm run typecheck
npm run build
```

## Manual test notes

1. Confirm normal attachments still render.
2. Force a development attachment to `scanStatus: "suspicious"` and confirm it renders as blocked.
3. Confirm Settings > Advanced > Admin Operations shows attachment quarantine placeholder status.

## Remaining work

- Add Supabase persistence and strict admin routes for quarantine review.
- Enforce quarantine in storage/signed URL delivery, not only in the renderer.
