# Task 73 - Data Export and Account Deletion Workflows

- Added Supabase export/deletion request schemas and own-user RLS.
- Added `profiles.deletion_requested_at` without any hard-delete route.
- Added async mock/API request services and safe local export preview.
- Added exact username confirmation and owned-community transfer blocking.
- Added request/cancel/status UI in Settings with clear destructive warnings.
- Explicitly excluded credentials, secrets, inaccessible private data, and unrelated audit logs.

Validation: `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
