# Task 139 - Attachment Scanning and Quarantine

## Result

Completed as a fail-closed production foundation. Scan status is persistent, uploader mutation cannot self-mark clean, new Supabase uploads receive no pending signed URL, Storage serves only clean/development-skipped objects with normal visibility, and blocked states remain non-renderable.

## Changed files

- `src/services/attachmentScanService.ts`
- `src/services/attachmentQuarantineService.ts`
- `src/services/attachmentService.ts`
- `src/services/uploadService.ts`
- `src/services/supabase/database.types.ts`
- `src/data/mockAttachments.ts`
- `supabase/migrations/20260710139000_attachment_scanning_quarantine.sql`
- `supabase/tests/rls/attachment_scanning_quarantine.sql`
- `scripts/attachment-malware-scanning-smoke-test.mjs`
- `scripts/attachment-quarantine-smoke-test.mjs`
- `docs/security/attachment-scanning-quarantine.md`
- `docs/task-checkpoints/task-139-attachment-scanning-quarantine.md`

## Verification

- `npm run attachments:scan:smoke`
- `npm run attachments:quarantine:smoke`
- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

No scanner provider/admin release endpoint exists, so production Supabase uploads intentionally remain pending and unserved. Live Storage/RLS tests remain required.
