# Task 393 - Audio Supabase Schema and RLS

## Status

Complete as a migration and policy foundation.

## Delivered

- Added radio session/listener and podcast episode/reaction/comment tables.
- Added private saved-audio records and query indexes.
- Added channel/community-aware audio visibility helpers.
- Added owner/role/permission-based host and publisher write controls.
- Added private podcast-audio and audio-cover buckets with path-bound storage policies.
- Added schema, RLS, storage, and staging verification documentation.

## Production Boundary

- No renderer component calls Supabase directly.
- No service-role secret or public media bucket was introduced.
- Applying and exercising the migration requires a disposable local/staging Supabase project.

## Validation

- `npm run audio:schema:smoke`
- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
