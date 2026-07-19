# Community production improvements report

## Current implementation

- Typed community creation services and default channel/role RPCs exist.
- Founder/first-member ownership is enforced by a forward migration.
- Public join, rules acceptance, leave protection and ownership transfer contracts exist.
- Community message send uses a client message ID and ordered local queue.
- Channel message Realtime has insert/update/delete mapping and ordering helpers.
- Role-aware menus, private/public channel visibility and moderation service surfaces are present.
- Central profile media components are available for member/avatar surfaces.

## Remaining work

- Execute hosted owner/admin/moderator/member/visitor RLS matrices.
- Verify that deleted/changed channels cannot leave stale active IDs after Realtime updates.
- Persist queued sends through app restart; the current queue waits for browser connectivity only while the renderer remains alive.
- Load-test member lists, channel trees and message history with windowing enabled.
- Validate voice/screen permissions and membership changes with two packaged clients.
- Verify announcement, event, search and moderation visibility using real private communities.

## Production decision

Community source coverage is broad, but hosted policy and restart-recovery evidence remain required before release approval.
