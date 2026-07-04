# Task 201 - Create file validation Edge Function placeholder

## Scope

- Added `validate-file` Supabase Edge Function placeholder.
- Added shared file metadata validation helper.
- Documented MIME, extension, size, and security expectations.

## Runtime impact

- Existing desktop upload UI behavior is unchanged.
- No file processing dependencies or secrets were added.

## Verification

- Run `npm run supabase:smoke`.
- When Supabase CLI is available, serve `validate-file` and call it with valid and invalid metadata.
