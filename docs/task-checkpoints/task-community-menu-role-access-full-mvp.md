# Task Checkpoint: Role-aware Community Menu Access

## Status
Completed.

## Scope
Implemented the production-level CommunityHeader menu foundation for owner/admin/moderator/member/visitor states while preserving the existing desktop chat layout, Mention Feed, Profile Page, custom titlebar, and Electron shell behavior.

## What changed
- Added typed community access concepts for:
  - owner
  - admin
  - moderator
  - member
  - visitor
  - public/private visibility
  - public read access
  - community permissions
- Added community permission helpers:
  - getCommunityAccess
  - hasCommunityPermission
  - canViewChannel
  - canSendMessage
  - getVisibleChannelsForCurrentUser
  - filterCommunityForAccess
- Added service layer for community membership/menu behavior:
  - communityMembershipService
  - communityMenuService
- Replaced CommunityHeader placeholder behavior with a real role-aware CommunityMenu.
- Added role-aware panels/modals:
  - CommunityAdminPanel
  - CommunityModeratorPanel
  - CommunityMemberMenu/Panel
  - CommunityVisitorMenu/Panel
  - CommunityJoinModal
  - CommunityLeaveModal
  - JoinCommunityButton
  - CommunityRoleBadge
  - CommunityMenuItem
  - PermissionGate
- Moved community admin/mod/member/visitor actions behind the CommunityHeader menu.
- Added visitor read-only behavior:
  - private channels hidden
  - public channel list shown when public read is enabled
  - composer disabled with Join Community action
  - visitor read-only notice in the sidebar
- Added mock role scenarios:
  - Aurora Studio: owner
  - North Dock: admin
  - Terra Lab: moderator
  - Pixel Guild: member
  - Orbit Works: visitor
- Added Supabase public access migration for:
  - communities.visibility
  - communities.public_read_enabled
  - channels.public_read_enabled
  - public read helpers
  - visitor public channel/message select
  - member-only message insert
  - authenticated public self-join
  - owner/self leave policy foundation
- Added a community role/access smoke script.

## Validation
- npm run typecheck: PASS
- npm run community:access:smoke: PASS
- npm run mock:smoke: PASS
- npm run build: PASS
- npm run supabase:smoke: PASS

## Supabase note
The existing Supabase smoke script passed, but the machine still reports that the Supabase CLI is not installed. Full migration execution/RLS reset testing should be run after installing the CLI:

```bash
supabase db reset
npm run supabase:smoke
```

Optional manual SQL smoke file:
- supabase/tests/community_menu_role_access.sql

## Manual role testing
- Select Aurora Studio and open the CommunityHeader menu: owner/admin panel and owner danger actions should be available.
- Select North Dock: admin panel should be available but owner-only actions should be limited.
- Select Terra Lab: moderator panel should be available, admin-only settings hidden.
- Select Pixel Guild: member menu should show info/notifications/leave/report actions.
- Select Orbit Works: visitor menu should show Join Community, private channels hidden, composer disabled.
- Join Orbit Works: membership updates locally and composer becomes enabled for public text channels.
- Leave Pixel Guild/North/Terra: membership is removed locally and public communities fall back to visitor behavior.

## Known remaining limitations
- Frontend role checks are UX-only; Supabase RLS remains the source of truth.
- Supabase CLI execution was not available in this environment.
- Role permission JSON is still simplified in the frontend helper and should be mapped to real Supabase role permissions later.
- Private invite/approval flow for private community join remains placeholder.
