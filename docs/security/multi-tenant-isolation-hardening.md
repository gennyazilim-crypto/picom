# Multi-tenant Isolation Hardening

## Scope and result

Picom currently treats each community as a tenant-like boundary. Future enterprise Organization/Workspace tenancy is documentation-only and not active. This pass reviewed community/channel/message paths, private data derivations, attachments, search, realtime, Storage, bots/webhooks, and restricted panels.

Two concrete gaps were fixed:

1. The Storage object read policy for attached message files previously checked community membership but not the linked message's channel visibility. It now requires `public.can_view_message(attachment.message_id)`.
2. Typing Broadcast and community Presence used public Realtime channels. They now request `private: true` and use `realtime.messages` RLS that authorizes exact Picom topic shapes by membership/channel visibility.

Mention stories and upcoming events are now filtered through current community/channel visibility before entering Mention Feed. Mention cards were already filtered.

## Boundary matrix

| Access path | Current enforcement | Result / remaining requirement |
| --- | --- | --- |
| Community list/detail | Supabase `communities` RLS; private member/owner, explicitly public rows for visitor read | Foundation present. Live two-user RLS verification remains a release gate. |
| Community members/roles | Membership- and role-scoped RLS/service queries | Do not expose sensitive member fields to visitors; production DTO review remains required. |
| Channel list | `can_view_channel` RLS plus client `canViewChannel` filtering | Private channels hidden; client gate is UX only. |
| Message list/mutations | Message RLS uses channel visibility/send/author or moderation rules; queries include community/channel | Foundation present; live cross-community ID tests required. |
| Advanced search | `search_accessible_entities` is authenticated-only and calls `can_view_channel`; local search filters visible channels | No identified leak. Keep RPC allowlist and direct RLS tests. |
| Mention Feed | App filters mentions, stories, and events through visible community/channel | Fixed stories/events. A future server feed must perform the same filtering before returning rows. |
| Profile activity/media | Mock profile assembly filters channels with current-user access | Safe for mock. Future server activity/media queries require RLS and should return safe DTOs only. |
| Attachment metadata | `attachments` RLS calls `can_view_message` | No identified metadata leak. |
| Attachment object bytes | Storage policy now calls `can_view_message` for attached objects; pending objects owner-only | Fixed. Public visitor delivery/signed URL behavior is a separate availability TODO, not a permission relaxation. |
| Postgres Changes | Source table RLS determines delivered rows | Current message/direct-message subscriptions rely on this documented Supabase behavior. Live socket denial test required. |
| Typing Broadcast | Private topic plus `realtime.messages` SELECT/INSERT policies; member and visible channel required | Fixed. Payload identity remains client-supplied; TODO move identity attribution to trusted server/database broadcast or ignore unverified names. |
| Community Presence | Private topic plus member-only `realtime.messages` policies | Fixed. TODO bind displayed identity to authenticated profile rather than trusting payload identity fields. |
| Direct-message realtime | Membership query before subscription plus direct-message table RLS | Foundation present. Reaction channel is table-RLS dependent; live outsider tests required. |
| Storage uploads | Path contains community/channel/pending/uploader and insert policy verifies member/channel relation | Add explicit `can_send_message_to_channel` enforcement if upload must be forbidden in read-only channels before production upload activation. Current message attach/send policies prevent final unauthorized message attachment. |
| Webhook management | Renderer service checks UX permission; table RLS scopes managers; delivery function is service-role only with token/rate/permission checks | No direct token exposure identified. Re-run live cross-community webhook management/delivery tests. |
| Bot credentials/actions | Credential table has RLS and no anon/auth grants/policies; server-side path required | Safe disabled foundation. Do not expose raw token after creation or renderer management without backend permission. |
| Reports/audit/moderation | Community-scoped policies and permission RPCs | Live owner/admin/mod/member/outsider tests required. |
| Admin Operations/Trust & Safety | Development-only access in dev; production calls `is_app_admin` | UI is not security boundary. Every future admin source endpoint must independently require app-admin and redact data. |
| Deep links/open in channel | Validated deep-link service plus navigation checks | Must re-check access after every fetch and show generic denial; never render stale cached private content. |
| Cache/offline queue | Current foundations are local and bounded | TODO partition future persistent entity/cache data by authenticated user and scope; clear inaccessible tenant records on logout/revocation. |

## Storage hardening details

The old object policy joined `attachments -> messages -> community_members` and granted any community member access to an attached object path, even if the linked message was in an owner/admin-only private channel. The replacement follows the same authoritative boundary as attachment metadata:

- pending path: uploader only;
- attached path: matching attachment record, attached status, non-null message, and `can_view_message`;
- `can_view_message` delegates to `can_view_channel`;
- no raw filesystem path is exposed.

This is additive in a new migration; migration history is not rewritten.

## Realtime authorization details

Approved private topics:

- `typing:community:{communityUuid}:channel:{channelUuid}` with `broadcast` extension;
- `presence:community:{communityUuid}` with `presence` extension.

Malformed UUIDs, wrong extension/topic combinations, unknown topics, visitors, outsiders, mismatched community/channel IDs, and members without channel visibility are denied. Realtime policy results are cached for a connection, so session revocation/membership changes must update JWT/disconnect the socket promptly.

Postgres Changes remain governed by each source table's RLS; the new policies are intentionally limited to Broadcast/Presence and do not broaden source table access.

Official behavior reference: [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization).

## Required live verification (release blockers)

Supabase CLI/staging execution is not proven by repository structure. Before connected beta/stable:

1. Apply all migrations to a disposable Supabase project and run all pgTAP suites.
2. Use owner, admin, moderator, member, visitor, anonymous, outsider, and second-community users.
3. Attempt direct REST/select/mutation by known IDs, not only UI navigation.
4. Subscribe outsiders to Postgres Changes, private typing, presence, direct messages, and reactions.
5. Attempt storage object download by known private path as normal member/visitor/outsider.
6. Search exact private message/user/channel terms through RPC and local/API UI.
7. Open feed/story/event/profile/deep links that target a private channel.
8. List/create/revoke webhooks and use bot credential tables across communities.
9. Call report/audit/admin RPCs from unauthorized sessions.
10. Revoke membership/session during active realtime/voice use and confirm disconnect/no cached private content.

Any unauthorized row, event, object byte, identity metadata, existence signal, or admin summary is a `No-Go`.

## Explicit TODO register

| TODO | Owner placeholder | Gate |
| --- | --- | --- |
| Run new and existing RLS/Storage tests with Supabase CLI in disposable staging | Backend/Security | Connected beta blocker |
| Add full two-socket private Broadcast/Presence/Postgres Changes tests | Realtime/Security | Connected beta blocker |
| Bind typing/presence identity to authenticated profile or trusted broadcast | Realtime | Stable blocker if these signals are trusted for moderation/security |
| Verify upload creation requires final send permission in read-only channels | Backend/Storage | Production upload blocker |
| Build RLS-backed Mention Feed/Profile activity/media source | Backend/Product | Production connected feed/profile blocker |
| Partition/clear future persistent caches by user/tenant after revocation | Desktop/Auth | Offline cache production blocker |
| Verify webhook/bot/admin/report/audit paths with cross-community users | Backend/Security | Feature activation blocker |
| Design Organization/Workspace tenant keys before enterprise schema | Enterprise/Security | Enterprise blocker |

## Validation commands

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

If Supabase CLI is unavailable, structural smoke does not replace live pgTAP and socket/object tests; record them as blocked.

