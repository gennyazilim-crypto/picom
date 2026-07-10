# Task 096 Checkpoint: Discovery Moderation Review Queue

## Outcome

Added a restricted Discovery moderation queue with five review states, safe public metadata, aggregate report signals, and transactional audit logging.

## Changes

- Added pending, approved, rejected, hidden, and suspended state support.
- Added app-admin-only list/update RPCs.
- Added the queue to existing guarded Admin Operations.
- Added local mock state for desktop workflow testing.
- Added `discovery_review` audit action and transactionally paired review/audit writes.
- Preserved the existing Discovery report-community flow.

## Safety

- Normal users and community-only moderators cannot access the app-wide queue.
- Private/unlisted communities are excluded.
- No members, channels, messages, attachments, report descriptions, identities, tokens, IPs, or secrets are returned.
- Direct review table access remains unavailable to renderer roles.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

Live app-admin/RPC/RLS testing requires Supabase CLI or staging and is not claimed by structural smoke alone.
