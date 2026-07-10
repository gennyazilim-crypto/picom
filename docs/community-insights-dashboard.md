# Community insights dashboard

Picom provides community owners and permitted admins with a privacy-conscious aggregate dashboard in **Community Management Center > Insights**. It uses a permission-checked Supabase RPC in API mode and local aggregates in mock mode.

## Implemented metrics

- total and new members
- aggregate active-member count
- messages and active channels in a bounded reporting window
- message counts per channel for channels the viewer may access
- anonymous voice session, participant-minute, and peak-concurrency totals
- open and total report counts

No individual ranking, member timeline, message body, report reason, reporter identity, IP address, or private credential is returned.

## Service and permission boundary

The renderer calls `communityInsightsService.getSnapshot()`. API mode uses `get_community_insights_v2(target_community_id, window_days)`; it does not query aggregate tables directly.

The RPC requires one of:

- community owner
- admin role level
- `viewInsights` permission
- `manageCommunity` permission

Frontend section visibility is UX only. Supabase checks permissions again, caps the reporting window at 90 days, and applies `can_view_channel` to channel-level rows.

## Voice data

`community_voice_usage_daily` contains only community/date aggregate counters. It intentionally contains no user identifier. Authenticated renderer roles have no direct access; a trusted voice backend may populate aggregates later.

## Desktop UI

- Compact metric cards use existing design tokens and `AppIcon`.
- Message distribution uses lightweight CSS bars instead of a chart dependency.
- Loading, permission, empty, mock, and API states are explicit.
- The implementation is desktop-only and adds no mobile layout.

## Operational follow-up

Apply `20260710197000_community_insights_v2.sql` in a Supabase-enabled environment and execute RLS/RPC tests with owner, admin, moderator, member, and visitor accounts. The local workstation does not currently have the Supabase CLI.
