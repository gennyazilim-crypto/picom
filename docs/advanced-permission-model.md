# Advanced permission model review

Status: architecture/security review; schema and runtime behavior unchanged  
Reviewed: 2026-07-10  
Platform: Picom Electron desktop for Windows, Linux and macOS

## Executive decision

Picom is not ready to add channel overrides, custom roles, bot/webhook scopes or more moderation actions on top of the current permission model. The existing UX foundation is useful, but the shared TypeScript keys, renderer access calculation and SQL/RLS helpers are not yet one authoritative contract.

Before expansion, Picom must introduce a versioned permission registry, server-computed effective access and parity tests across owner, admin, moderator, member, visitor and service principals. Frontend checks remain presentation only.

## Current model

### Role hierarchy

Current role intent:

- Owner: community owner or Owner role/level 100.
- Admin: Admin role or level at least 80.
- Moderator: Moderator role or level at least 60.
- Member: joined user below moderator level.
- Visitor: no membership; may read approved public content only.

Role rows carry `level` and permission JSON, but current renderer helpers derive fixed permission sets from role name/level instead of the role's stored permission map.

### Existing TypeScript registries

Shared `PermissionKey` currently includes:

- `manageCommunity`, `manageChannels`, `manageRoles`
- `deleteAnyMessage`, `editOwnMessage`, `deleteOwnMessage`, `sendMessages`
- `viewPrivateChannels`, `kickMembers`, `banMembers`, `manageNotifications`
- `manageWebhooks`, `viewInsights`, `sendAnnouncements`

Renderer `CommunityPermissionKey` separately includes:

- `manageMembers`, `moderateMessages`, `createInvites`, `viewAuditLog`

but omits shared keys such as own-message editing/deletion, kick/ban, notifications and webhooks. This duplication can cause compile-time and runtime policy drift.

### Existing SQL behavior

- Public visitors can read only public-read-enabled, non-private channels in public/read-enabled communities.
- Joined users can read non-private channels.
- Private-channel SQL access is effectively owner or role level at least 80 in the public-access migration.
- Message send SQL checks membership, visible text channel and author identity but does not evaluate `sendMessages` permission JSON.
- Invite management accepts owner, level at least 60 or `createInvites` JSON permission in its helper.
- Bot management accepts owner, level at least 80 or `manageCommunity`; it does not use a dedicated bot permission.
- Webhook delivery revalidates the webhook creator's owner/admin/`manageChannels` status; a dedicated `manageWebhooks` contract is not consistently authoritative.

## Critical consistency findings

### P0: duplicated permission registries

The shared DTO and renderer community registry differ. Adding a permission to one does not guarantee that UI, services, database types and SQL recognize it.

Required resolution: one canonical `PermissionKey` in `packages/shared`, generated/validated database enum/check mapping and exhaustive tests.

### P0: renderer ignores stored role permissions

`getCommunityAccess` uses fixed arrays based on role status. A limited admin appears fully capable in the UI; a custom moderator permission may not appear. This contradicts permission-filtered admin goals.

Required resolution: API/mock DTO supplies validated role permission grants; renderer computes UX from those grants plus immutable owner rules.

### P0: message-send parity gap

Renderer can disable send when `sendMessages` is absent, but `can_send_message_to_channel` currently authorizes any member who can view a text channel. Frontend hiding is not enforcement.

Required resolution: SQL effective permission check must gate message insert, reactions/uploads where applicable and announcement-specific sends.

### P0: private-channel parity gap

Renderer grants `viewPrivateChannels` to all fixed admins/owners and no moderators; SQL grants owner/level 80. Stored `viewPrivateChannels` is not authoritative. Future channel overrides would magnify this discrepancy.

Required resolution: a server `can_view_channel` calculation incorporating canonical base grants and approved channel overrides, used by messages, attachments, search, events, realtime joins and exports.

### P1: action permissions are too coarse

`moderateMessages`, `manageMembers`, `manageCommunity` and role level are used as broad substitutes. Timeout, report review, evidence view, kick, ban, appeal review and audit view need separate least-privilege decisions.

### P1: bot/webhook scopes are not first-class community permissions

Bot and webhook code uses owner/admin/broad management checks while shared keys only partially cover the domain. Service credentials also require action/channel scopes independent of the human manager's current UI permissions.

### P1: hierarchy is not a complete authorization rule

Level is useful for “may manage target role/member,” but must not grant every capability. Role rank and permission grant are separate conditions.

## Target permission registry

Canonical keys should be grouped but remain flat/versioned for storage and DTO safety.

### Community configuration

- `manageCommunity`
- `manageChannels`
- `manageRoles`
- `manageMembers`
- `manageNotifications`
- `viewInsights`
- `viewAuditLog`
- `createInvites`

### Channel participation

- `viewChannels`
- `viewPrivateChannels` (legacy migration helper; channel overrides become authoritative later)
- `sendMessages`
- `sendAnnouncements`
- `addReactions`
- `uploadAttachments`
- `joinVoice`
- `shareScreen`

### Message/member moderation

- `editOwnMessage`
- `deleteOwnMessage`
- `deleteAnyMessage`
- `reviewReports`
- `viewModerationEvidence`
- `timeoutMembers`
- `kickMembers`
- `banMembers`
- `reviewAppeals`

### Integrations

- `manageWebhooks`
- `manageBots`
- `useExternalIntegrations` (future; disabled until approved)

This list is a proposed registry, not a schema change. Every key needs owner, product, security and RLS semantics before activation.

## Role defaults and hierarchy

### Owner

- Ownership is a community invariant, not a normal editable role grant.
- Owner receives all approved human permissions.
- Ownership transfer is a separate audited transaction.
- Owner cannot be targeted by lower roles.

### Admin

- Starts from an approved admin template but can be limited.
- Never transfers ownership or manages the owner.
- Can manage only lower roles/members and cannot grant permissions they do not possess.
- Bot/webhook management requires explicit keys, not admin label alone after migration.

### Moderator

- Minimal default: report review, bounded evidence, message moderation and optional timeout.
- No community settings, role assignment, private-channel browsing, bot/webhook management, kick or ban unless explicitly granted and hierarchy-safe.
- Moderation context access is purpose-bound and does not imply ordinary private-channel membership.

### Member

- Default participation permissions in visible channels.
- Own-message operations under retention/edit-window policy.
- No management/moderation permissions.

### Visitor

- No role and no grant set.
- Public metadata/content read only when community and channel public-read gates both allow it.
- Cannot send, react, upload, join voice, enumerate private channels/members or use integrations.

## Effective permission calculation

Proposed order:

1. Verify authenticated identity or explicit anonymous public-read request.
2. Load community status and membership/role atomically enough for the operation.
3. Owner invariant grants approved owner capabilities, subject to global kill/policy restrictions.
4. Start from role grants from the canonical registry.
5. Apply community-wide operational restrictions (timeout, suspension, read-only/maintenance).
6. Apply channel override precedence for the selected channel.
7. Apply target hierarchy for member/role actions.
8. Apply resource state (deleted, archived, quarantined, private, expired).
9. Apply app-level feature/kill switch; security enforcement remains backend-side.
10. Return allow/deny plus a safe reason code, never internal policy details.

Explicit deny wins over allow at the same/specific scope. Owner bypasses ordinary channel role denies only if the product policy explicitly chooses that behavior; global/legal/security holds still win.

## Channel overrides

Detailed design belongs to Task 262. This review establishes constraints:

- Overrides target a role first; direct-member overrides are deferred unless a proven need exists.
- Override values are `inherit`, `allow` or `deny` for an approved channel-scoped key subset.
- Private channels start deny-by-default and require explicit visibility grants or owner access.
- Category inheritance must be materialized/evaluated consistently and tested for moves/reordering.
- The same effective check controls channel list, messages, attachments, search, realtime room join, voice, exports and deep links.
- Frontend must consume a server-visible channel list; it must not fetch then hide unauthorized rows.

## Bot permissions

Bots are service principals, not Admin users.

- Installation binds bot, community and a dedicated bot role/scope set.
- Bot can request only declared capabilities; installer can grant only permissions they possess and are allowed to delegate.
- Default bot role has no permissions.
- Human `manageBots` controls installation/credential lifecycle; it does not become the bot's runtime permission.
- Runtime token maps to one installation/credential and validates action, channel, rate limit and revocation server-side.
- Bots cannot receive private message content or private-channel events unless explicitly granted for that channel and platform rollout approves it.
- Credential raw token is one-time display; hash/prefix only at rest and no renderer storage/logging.
- Public bot API remains disabled until separate security review.

## Webhook permissions

- `manageWebhooks` governs create/list/revoke for permitted channels.
- Creator must be able to view/manage the target channel and delegate webhook message send.
- Webhook credential is scoped to one webhook/channel/community and cannot change channel.
- Delivery revalidates active credential, installation state, channel visibility/type, feature kill switch and rate limit.
- Webhooks cannot read messages, member lists or channel history.
- Revoking creator permission should not silently leave unmanaged active credentials; define transfer/revoke policy and audit it.
- Webhook-originated messages remain distinguishable, non-editable by normal users and subject to moderation/deletion policy.

## Migration from basic permissions

### Phase 0: freeze and inventory

- Freeze new keys/overrides.
- Inventory every TypeScript key, UI gate, service check, RLS policy, SQL helper, RPC and realtime join rule.
- Record current default behavior as contract tests before changing it.

### Phase 1: canonical registry

- Make `packages/shared` the single TypeScript source.
- Add exhaustive serializers/validators and database mapping/version.
- Reject unknown keys safely; do not treat malformed JSON as allow.
- Align mock role fixtures with the canonical defaults.

### Phase 2: server effective-permission helpers

- Introduce narrowly named SQL helpers such as `has_community_permission` and versioned `can_view_channel`/`can_send_message_to_channel`.
- Keep old helpers as compatibility wrappers while parity tests run.
- Add indexes only from measured query plans.

### Phase 3: data backfill

- Map Owner/Admin/Moderator/Member role names/levels to explicit versioned grants.
- Preserve custom role grants only when keys validate; quarantine/report unknown values rather than broadening access.
- Backfill in staging, compare old/new effective decisions and produce a mismatch report.
- Backup before production migration; rollback may restore helper/version selection, not safely undo every later role edit.

### Phase 4: renderer/service migration

- API returns safe role/effective capability DTOs; UI stops using fixed role arrays.
- Service layer owns authorization-aware calls; components do not query Supabase directly.
- Permission denial from backend overrides optimistic/local state and refreshes access.

### Phase 5: enforce and remove legacy

- Switch all message/attachment/search/realtime/export/bot/webhook paths to the new helpers.
- Run hosted negative tests and shadow mismatch monitoring.
- Remove old fixed arrays/wrappers only after a compatibility window and rollback checkpoint.

### Phase 6: channel overrides

- Add only after base parity reaches zero unexplained mismatches.
- Roll out disabled-by-default to internal/staging communities before beta.

## RLS and backend impact

Every affected path must use the same effective model:

- Communities: public/member visibility and management.
- Channels/categories: list/read/create/update/delete and overrides.
- Messages/replies/reactions: read/send/edit/delete/moderate.
- Attachments/storage: upload metadata, signed read and quarantine.
- Search/exports/saved messages/notifications: filter before returning rows.
- Community members/roles/invites/bans/reports/appeals/audit.
- Events/announcements/voice room tokens and realtime subscriptions.
- Webhook/bot credential lifecycle and backend-only delivery/action endpoints.

RLS requirements:

- Security-definer helpers set fixed `search_path` and receive resource IDs, not trusted client role claims.
- Normal clients cannot mutate permission/role/override rows outside narrow policies/RPCs.
- Role assignment transaction verifies actor grant subset and target hierarchy.
- Cache/effective-access materialization invalidates on role, membership, override, ban/timeout and community visibility changes.
- Realtime sockets disconnect/leave rooms after access revocation.
- Anonymous visitor policies never call membership assumptions that expose private rows.
- Error shape is generic enough to avoid private-resource existence leaks.

## Required parity and security tests

Matrix dimensions:

- Owner, full/limited admin, moderator with/without each grant, member, visitor, banned/timed-out user.
- Public/private community; public/private/announcement/voice/forum channel.
- Base role allow/deny, category/channel override, resource deleted/archived.
- Own/other message, lower/equal/higher member target.
- Bot/webhook valid/revoked/over-scoped credential.

For every case compare:

- Channel list result.
- Direct resource fetch/deep link.
- Message/attachment/search/export/notification behavior.
- Realtime room/event access.
- UI capability presentation.

Any backend-allow/UI-deny mismatch is a UX bug; backend-deny/UI-allow is a failed optimistic action; backend cross-tenant/private allow is a release-blocking security defect.

## Rollout and rollback

- Version the evaluator and role grants.
- Shadow-evaluate old/new decisions in staging using IDs/reason codes only, never content.
- Feature flag controls UI adoption; backend version gate controls enforcement.
- Emergency rollback selects the last validated evaluator and disables role/override editing.
- Do not rollback by granting broad Admin access or turning off RLS.
- Preserve append-only role/permission audit events.

## Explicit non-goals

- No schema, RLS, UI or runtime changes in this review task.
- No permission-by-frontend-only implementation.
- No arbitrary user-level overrides, wildcard permissions or executable policy expressions.
- No public bot API, plugin runtime or webhook read access.
- No mobile/web permission UI.
- No claim that current basic permission behavior is production-complete until hosted parity tests pass.
