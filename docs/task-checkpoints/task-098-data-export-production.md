# Task 098 Checkpoint: User Data Export Production

## Outcome

Replaced the renderer-only safety preview with an authenticated, RLS-backed, bounded export foundation and explicit local-settings merge/download flow.

## Changes

- Added `user-data-export` Edge Function and verified-JWT config.
- Added request metadata hardening/indexes.
- Exported allowlisted profile, membership, own message, own attachment metadata, follows, and saved-message records.
- Merged typed desktop settings in renderer memory.
- Updated Settings states/copy and disabled download when no in-memory payload exists.
- Added limits, truncation markers, retry guard, ready/failed status, and expiration metadata.

## Safety

- Server data queries use the authenticated user's RLS client.
- Service role only updates request status.
- Payload is not stored in database/localStorage.
- Passwords, sessions, tokens, authorization headers, service keys, raw storage paths, audit logs, and other users' private data are excluded.
- Query failure returns no partial export.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

Live Edge Function/RLS and large-account tests require Supabase CLI or staging and are not claimed by structural smoke alone.
