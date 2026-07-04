# Task 166 Checkpoint: Create Storage RLS policy for attachments

## Completed

- Added Storage policies for `message-attachments` bucket.
- Allowed own pending uploads.
- Allowed reads for own pending and attached visible community files.
- Allowed deletion of own pending uploads only.
- Added the policy migration to Supabase schema smoke test.
- Documented RLS implications and manual verification steps.

## Changed files

- `supabase/migrations/20260704002300_storage_message_attachments_policies.sql`
- `scripts/supabase-schema-smoke-test.mjs`
- `docs/storage-attachments-rls.md`
- `docs/task-checkpoints/task-166-storage-attachments-rls.md`

## Verification

Run:

```bash
npm run supabase:smoke
npm run typecheck
npm run build
```