# Task 095 Checkpoint: Community Discovery Production v1

## Outcome

Connected DiscoveryView to a production-safe public profile service and added fail-closed Supabase approval, join/request, search/filter, and report foundations.

## Changes

- DiscoveryView now loads through `communityDiscoveryService` instead of ignoring it.
- Added search, category filters, open-join/request labels, pending state, empty/loading states, and report action.
- Added backend-only discovery review and join-request tables.
- Added safe public listing RPC with explicit public/listed/read/approved filters.
- Added authenticated atomic join/request RPC.
- Added typed Supabase RPC contracts and join-policy metadata.

## Safety

- Private, unlisted, public-read-disabled, pending, rejected, and unreviewed communities cannot be returned by the production RPC.
- No member personal data, channels, messages, attachments, invite secrets, audit logs, or moderation notes are exposed.
- Review/join-request tables have no direct renderer grants.
- Community/report/channel/message permissions and RLS remain authoritative.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

Live approval/join/RLS verification requires Supabase CLI or staging and is not claimed by structural smoke alone.
