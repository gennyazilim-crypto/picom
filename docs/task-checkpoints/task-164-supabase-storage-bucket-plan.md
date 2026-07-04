# Task 164 Checkpoint: Create Supabase Storage bucket plan

## Completed

- Documented private Supabase Storage bucket plan.
- Documented path structure for pending and attached message uploads.
- Documented metadata relationship to `public.attachments`.
- Documented policy placeholders, environment variables, and test plan.

## Changed files

- `docs/supabase-storage-bucket-plan.md`
- `docs/task-checkpoints/task-164-supabase-storage-bucket-plan.md`

## Verification

Run:

```bash
npm run supabase:smoke
```

Manual review: confirm the bucket plan does not require service-role keys in the renderer and keeps private attachment access behind future policies.