# Task 178: Custom emoji moderation and storage

## Completed

- Added signature, MIME, extension, and 512 KB validation before emoji upload.
- Added private Supabase Storage paths and short-lived signed URL delivery.
- Preserved database uniqueness per community and normalized names.
- Added active/disabled moderation states plus soft deletion.
- Added management-only UI actions and RLS/storage policies.
- Documented the no-copyrighted-default-assets policy.

## Safety

- Storage paths never contain user file names.
- Renderer permission checks are backed by Supabase RLS.
- Disabled/deleted emoji do not resolve in the normal picker path.
- Production upload never exposes storage credentials or public object URLs.

## Verification

- `npm run emoji:custom:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
