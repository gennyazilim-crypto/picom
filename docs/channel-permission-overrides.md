# Channel permission overrides plan

Status: design only; no schema, RLS or runtime override is enabled  
Reviewed: 2026-07-10  
Depends on: canonical/effective permission work in `docs/advanced-permission-model.md`

## Decision

Picom may add per-category/per-channel role overrides and exceptional direct-member overrides only after the basic permission model has one canonical registry and zero unexplained renderer/RLS parity mismatches. Overrides must use a tri-state (`inherit`, `allow`, `deny`) and be evaluated server-side for every resource path.

## Goals

- Let owners/admins create focused public, private, announcement and staff channels.
- Keep permissions understandable and previewable before saving.
- Preserve least privilege when channels move categories or roles change.
- Make private-channel existence and content deny-by-default.
- Ensure direct API, deep link, search, realtime and storage access match the channel list.

## Non-goals

- Implementation or migration in this task.
- Executable policy expressions, wildcards or conditions based on message content.
- Cross-community roles/overrides.
- Frontend-only enforcement.
- Automatic bot/plugin access.
- Multiple-role membership until separately approved; current membership has one role.
- Mobile/web permission editor.

## Channel-scoped permission keys

The first approved subset should remain small:

| Key | Meaning | Applies to |
| --- | --- | --- |
| `viewChannel` | Discover and read channel metadata/content | channel list, messages, attachments, search, notifications, deep links |
| `sendMessages` | Create normal text messages/replies | text/forum post contexts permitted by channel type |
| `manageChannel` | Edit channel configuration and approved overrides | channel settings only; not community/role ownership |
| `addReactions` | Add/remove own reactions | visible message targets |
| `uploadAttachments` | Upload/attach permitted files | visible writable message context plus scan/storage gates |

Future voice/announcement keys (`joinVoice`, `shareScreen`, `sendAnnouncements`, thread/forum actions) require separate approval but use the same evaluator.

Permissions do not silently imply one another except where explicitly validated:

- Any action requires `viewChannel` first.
- `manageChannel` does not imply `manageRoles`, ownership or private-channel access elsewhere.
- `sendMessages` does not imply reactions/uploads.
- `uploadAttachments` also requires message-send/attachment policy where an attachment cannot exist independently.
- Channel type can restrict an allowed permission: e.g. `sendMessages` does not make a voice-only channel a text channel.

## Override value

```ts
export type PermissionOverrideEffect = "inherit" | "allow" | "deny";

export type ChannelPermissionOverride = Readonly<{
  channelId: string;
  subjectType: "role" | "member";
  subjectId: string;
  permission: ChannelScopedPermissionKey;
  effect: PermissionOverrideEffect;
}>;
```

`inherit` should normally be represented by no stored row. Removing an override restores inheritance; it is not an allow.

## Scope model

### Community role grants

Canonical base permission for the member's role. This remains the default for channels without overrides.

### Category role overrides

Optional role-level policy inherited by channels in a category. Category override editing is appropriate for groups such as public, staff or announcement sections.

### Channel role overrides

Role-level policy specific to one channel and more specific than category/base.

### Channel member overrides

Exceptional direct allow/deny for one existing community member. It is intended for bounded cases such as a private project room, not routine role design.

Direct member overrides require:

- Explicit target and permission preview.
- Audit reason and actor.
- Same hierarchy/delegation checks as role grants.
- Automatic removal/ineffectiveness after membership deletion.
- Owner/admin review surface so exceptions do not become invisible policy debt.
- Optional expiry only after server-time and cleanup semantics are approved.

Prefer creating a purpose-specific lower role when several members need the same access.

## Effective decision order

Evaluate one user/resource/action at server request time:

1. **Global hard deny:** unauthenticated action, suspended community/account, ban, active timeout/action restriction, deleted/archived/quarantined resource or backend kill switch.
2. **Visitor public read:** only `viewChannel`, only when community is public/read-enabled and channel is non-private/public-read-enabled. All other permissions deny.
3. **Membership:** require active membership for non-visitor access.
4. **Owner invariant:** owner receives approved channel capabilities unless global/legal/security hard deny applies. Owner override behavior must be documented in UI; ordinary role/member deny does not lock out the owner.
5. **Base role grant:** canonical role permission/default by channel type.
6. **Category role override:** explicit allow/deny replaces inherited base result for that key.
7. **Channel role override:** explicit allow/deny replaces category/base result.
8. **Channel member override:** explicit allow/deny replaces role result for that user.
9. **Dependency/resource checks:** `viewChannel`, channel type, message ownership, attachment policy, hierarchy and current target state.

At the same scope/specificity, `deny` wins. Duplicate rows must be impossible. Across scopes, the most specific explicit value wins. Global hard denies always win.

## Future multiple-role conflict rule

If multiple roles are ever approved:

- Evaluate all role effects at the same scope.
- Any explicit deny at that scope wins over allows.
- Otherwise any explicit allow wins; otherwise inherit.
- Category/channel specificity still applies after aggregating roles.
- Direct member effect remains the final ordinary override.
- Owner/global rules remain unchanged.

Do not add multiple roles merely to implement this plan.

## Private-channel model

- `is_private = true` establishes a deny-by-default visibility boundary.
- Owner remains authorized under owner invariant.
- Other members require an explicit role/member `viewChannel: allow` at category/channel scope under the new model.
- Legacy `viewPrivateChannels` may be migrated into explicit grants for an approved Admin/staff role, then retired from runtime decisions.
- Visitors/anonymous users never receive private channel metadata, IDs, names, message counts, member presence, attachments, search results, notifications or existence-confirming errors.
- A private channel moved to another category preserves its channel-specific overrides; inherited category behavior is recalculated and previewed before move.
- Turning a public channel private requires confirmation, permission diff preview, cache invalidation and realtime room eviction.

## Role hierarchy and override management

An actor may edit an override only when all are true:

- Actor has authoritative `manageChannel`/`manageChannels` for the target and can view it.
- Target role/member is below the actor's effective hierarchy.
- Actor is allowed to delegate that permission and currently possesses it at a sufficient scope.
- Requested change does not affect Owner or create/elevate an owner-equivalent role.
- Admin cannot grant a permission reserved to owner or manage equal/higher roles.
- Moderator receives no override editor unless explicitly granted, and cannot grant moderation/management powers beyond their delegable set.
- Target belongs to the same community; role belongs to the same community.

Special cases:

- Granting `manageChannel` is high risk and owner/admin-only by default.
- A user cannot create a direct override for themselves.
- Last owner access cannot be removed.
- Bot/webhook subjects use dedicated service-principal scopes, not member overrides.

## Proposed persistence model

Planning shape only:

```text
channel_role_permission_overrides
- id
- community_id
- channel_id
- role_id
- permission_key
- effect (allow | deny)
- created_by
- created_at
- updated_at
- unique(channel_id, role_id, permission_key)

channel_member_permission_overrides
- id
- community_id
- channel_id
- user_id
- permission_key
- effect (allow | deny)
- reason_code
- created_by
- created_at
- updated_at
- unique(channel_id, user_id, permission_key)
```

If category overrides are approved, use a separate category-role table or a typed resource scope; do not overload nullable channel/category columns in a way that permits ambiguous rows.

Constraints:

- Foreign keys confirm same-community relationships through trusted RPC validation.
- Permission key/effect check constraints use the versioned registry.
- No normal client direct insert/update/delete; mutation occurs through permission-checked RPC.
- Delete channel cascades override configuration, but append-only audit rows retain safe IDs/facts.
- Member override may cascade with membership only if audit/evidence integrity is preserved separately.

## RLS and SQL evaluator

Recommended helpers:

```text
effective_channel_permission(target_channel_id, target_permission) -> boolean
can_view_channel(target_channel_id) -> boolean
can_send_message_to_channel(target_channel_id) -> boolean
can_react_in_channel(target_channel_id) -> boolean
can_upload_to_channel(target_channel_id) -> boolean
can_manage_channel(target_channel_id) -> boolean
```

Requirements:

- Helpers derive identity from `auth.uid()`; never trust client role/permission arrays.
- Security-definer functions set fixed `search_path` and avoid dynamic SQL.
- Anonymous execution is granted only to the narrow public `can_view_channel` path.
- Unknown/malformed keys deny, never allow.
- Manager RPC verifies hierarchy, delegation and same-community subject before mutation.
- Direct table grants are absent or read is restricted to authorized managers; ordinary members need only effective result, not policy internals.
- Evaluator query plans are measured before indexes/materialization are added.

## Enforcement surface

`viewChannel` must gate:

- Community sidebar/channel metadata.
- Messages, replies, reactions and thread/forum content.
- Attachments and signed URLs/thumbnails.
- Search, saved messages, exports, notifications and mention/story/profile activity links.
- Realtime room joins/events/presence/typing/read states.
- Voice room tokens/participant visibility and screen-share metadata.
- Deep links and `Open in channel` actions.

Write permissions must gate their mutations and optimistic reconciliation:

- Message/reply create.
- Reaction add/remove.
- Attachment upload/finalize.
- Channel update/delete/override changes.

Filtering after unauthorized rows reach the renderer is not acceptable.

## Realtime and cache invalidation

After an override, role, membership, ban/timeout or privacy change commits:

- Publish a safe permission/membership update event.
- Recompute active channel availability.
- Remove unauthorized sockets from channel/voice rooms.
- Drop unauthorized cached messages/search/attachments where practical.
- If active channel becomes invisible, navigate to first permitted channel or access-denied state without revealing its prior content.
- Reject queued/offline writes with `PERMISSION_DENIED`; do not keep retrying.
- Revoke/invalidate signed attachment URLs according to provider capability and short expiry.

Event contains IDs/version only, no private policy details.

## Desktop management UX

- Existing Community Management Center > Channels opens a desktop permission editor.
- Subject list separates roles and exceptional members.
- Each permission shows Inherit/Allow/Deny and the computed result plus source (`role`, `category`, `channel`, `member`, `global restriction`).
- Private-channel template starts deny-by-default with explicit role selection.
- Show change summary: who gains/loses view/send/react/upload/manage before Save.
- Dangerous visibility/manage changes require confirmation.
- Save through one atomic RPC; stale policy version returns conflict and reload prompt.
- Keyboard/focus/accessibility and light/dark tokens follow existing Picom design.
- No mobile layout.

## Migration plan

1. Complete Task 261 canonical registry/server parity work.
2. Add evaluator tests that reproduce current Owner/Admin/Moderator/Member/Visitor behavior.
3. Add role override tables/RPCs in staging with the feature disabled.
4. Backfill private-channel access from validated legacy owner/admin behavior into explicit role grants.
5. Shadow old/new `can_view_channel` decisions and investigate every mismatch.
6. Add management UI after hosted RLS tests pass.
7. Enable role overrides for internal communities.
8. Add exceptional member overrides only after audit/review UX exists.
9. Remove legacy `viewPrivateChannels` runtime shortcut after compatibility window.

Rollback disables override editing and selects the last validated evaluator version; it must not turn off RLS or broadly expose private channels.

## Test matrix

- Owner, limited/full admin, moderator, member, visitor, timed-out/banned user.
- Public/private community and public/private text, announcement, forum and voice channels.
- Inherit/allow/deny at base/category/channel/member layers.
- Equal/higher/lower role/member target and self-override attempts.
- Channel move, type change, public-to-private transition and deletion.
- Message, reaction, upload, search, notification, export, attachment URL and realtime room access.
- Bot/webhook attempts prove member overrides do not grant service-principal access.
- Cross-community role/channel/subject IDs and malformed keys deny safely.
- Concurrent editor version conflict and rollback.

## Production gates

- Canonical registry and hosted renderer/RLS parity tests pass.
- Private-channel non-disclosure tests cover every enforcement surface.
- Mutation RPC, hierarchy/delegation and audit tests pass.
- Realtime eviction/cache invalidation is verified with two clients.
- Query performance is measured on production-like channel/member counts.
- Support/owner docs explain effective-result sources and recovery.
- Emergency disable path is tested without weakening access control.
