# Task 197 checkpoint: Community insights v2

## Delivered

- Added an owner/permitted-admin `Insights` section to the existing desktop Community Management Center.
- Added compact aggregate cards and token-based message-per-channel bars without a chart dependency.
- Added mock-mode aggregates and a typed Supabase service boundary.
- Added `get_community_insights_v2`, which rechecks community permissions server-side.
- Added trusted-backend-only daily voice aggregate storage without user identifiers.

## Privacy and security

- No message body, report reason, reporter identity, member identity, IP, token, or secret is returned.
- Renderer visibility is UX only; the RPC raises `42501` unless the caller has owner or permitted-admin access.
- Channel metrics require `can_view_channel`; authenticated renderer roles cannot read the voice aggregate table.

## Validation

- `npm run community:insights:v2:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining operational step

Apply the migration in a Supabase-enabled environment and have a trusted voice backend update aggregate rows. Live RLS execution remains an environment follow-up because the Supabase CLI is not installed locally.
