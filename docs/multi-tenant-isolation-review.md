# Multi-Tenant Isolation Review

Picom communities are tenant-like boundaries. A user in one community must not access another community's private channels, messages, attachments, members, reports, moderation data, or realtime rooms unless explicit membership and permissions allow it.

## Current strengths

- Supabase RLS migrations exist for core MVP tables.
- `community_id` is present on community-scoped data such as channels, messages, roles, members, attachments, reports, and moderation placeholders.
- Message queries filter by both `communityId` and `channelId`.
- Channel queries filter by `community_id`.
- Members queries filter by `community_id`.
- Private channel access boundary SQL tests exist under `supabase/tests/`.
- Member-only community access SQL tests exist under `supabase/tests/`.
- Realtime docs state that authenticated Supabase RLS remains the authorization boundary.
- Storage docs use community/channel-scoped attachment paths.

## Isolation boundaries to preserve

- Community membership checks must gate community reads.
- Channel visibility must gate channel, message, reaction, attachment, and search reads.
- Private channels must remain hidden from unauthorized users.
- Attachment metadata and file paths must not leak private channel data.
- Realtime subscriptions must not bypass database visibility.
- Deep links must navigate only after access checks and show safe errors for inaccessible targets.
- Admin, moderation, report, audit, and trust/safety views must remain restricted.

## Backend/RLS review checklist

- Communities: non-members cannot read private community data.
- Community members: users can only list members for communities they belong to.
- Roles: role data is scoped to the community.
- Channels: public channels require membership; private channels require the configured permission boundary.
- Messages: reads require visible channel access; writes require membership and send permission.
- Reactions: reaction reads must not reveal hidden message existence.
- Attachments: metadata and storage object access must follow message/channel visibility.
- Invites: invite acceptance must not expose unrelated community metadata.
- Reports: report queue access requires moderator/admin permission in the target community.
- Audit logs: audit log access requires owner/admin permission and must not cross communities.
- Search: search results must be filtered by channel visibility.
- Realtime: room names include community/channel IDs and server-side access remains enforced by Supabase Auth/RLS.

## Frontend review checklist

- ServerRail must only render communities returned by the data source.
- CommunitySidebar must hide private channels when permissions deny access.
- ChatMain must clear or block stale channel state when switching communities.
- Message search jump must fail safely if the message is deleted or inaccessible.
- Deep links must validate IDs and show an access error instead of rendering stale data.
- Context menu actions must stay hidden/disabled for unauthorized users.
- Admin Operations and Trust/Safety views must remain development/app-admin gated.

## Known gaps and risks

- Some advanced/community-admin features are still placeholder-local and require Supabase/RLS enforcement before production enablement.
- Private channel role-based permissions are documented as a foundation, but production policy expansion must be tested before release.
- Search and reports need live Supabase RLS verification before beta if enabled in API mode.
- Storage signed/private URL behavior is documented but still needs production access verification.
- Realtime visibility depends on Supabase channel/table policies and must be tested with two authenticated users.

## Required manual tests

1. Seed two communities with separate owners and members.
2. Log in as a member of community A and verify community B is not visible.
3. Verify public channels in community A are visible only to members.
4. Verify private channels are hidden from unauthorized members.
5. Attempt direct message fetch by known private channel/message ID and confirm access is denied.
6. Attempt attachment metadata/file access for private channel content and confirm access is denied.
7. Subscribe two clients to realtime and confirm unauthorized users do not receive private channel events.
8. Run `supabase/tests/member_only_community_access.sql` against a local/staging Supabase project.
9. Run `supabase/tests/private_channel_access_boundaries.sql` against a local/staging Supabase project.

## Release blocker criteria

- Unauthorized user can read another community's messages.
- Unauthorized user can discover private channel messages through search, reactions, attachments, or realtime.
- Storage URLs expose private channel files without a valid access check.
- Deep links render inaccessible community/channel/message content.
- Admin/moderation/report data is visible to normal users.

## Decision

The current project has the right isolation foundations and documentation, but production readiness still requires live Supabase RLS tests with separate users before enabling API-backed beta/stable releases.
