# Public read-only community hardening

Status: reviewed and locally hardened; hosted RLS validation remains required  
Reviewed: 2026-07-10  
Platform: Picom Electron desktop for Windows, Linux and macOS

## Access contract

A visitor is an unaffiliated user with no active membership in the community. Public read-only access exists only when:

- community visibility is `public`;
- community `public_read_enabled` is true for content;
- channel is not private;
- channel `public_read_enabled` is true; and
- resource is active and otherwise safe to expose.

Visitors may read approved public community metadata, public channel metadata and public messages. They cannot send, edit, delete, reply, react, upload, join voice, enumerate private channels, manage anything or infer hidden-resource existence. Joining is a separate authenticated, explicit and server-authorized action.

## Current enforcement review

### Community and channel RLS

- Public communities are selectable; private communities require owner/membership.
- `can_read_public_channel` requires public/read-enabled community, non-private channel and channel public-read enabled.
- `can_view_channel` is reused by message and attachment visibility.
- Message insert requires authenticated membership and a visible text channel; anonymous/visitor inserts fail.
- The existing pgTAP fixture proves public/private community, channel, message and authenticated visitor attachment-metadata boundaries.

### Attachment access

- Attached metadata follows `can_view_message`, which follows `can_view_channel`.
- Pending uploads remain uploader-only.
- The compatibility view is `security_invoker`, preventing view-owner RLS bypass.
- Private channel attachment metadata is denied to visitors in current tests.

Production file delivery must still authorize the storage object/signed URL. A public metadata row must not expose a raw private storage path or bypass quarantine/scan state.

### Profiles and members

- Hosted `community_members` SELECT requires membership in that community.
- Hosted profile SELECT requires self or shared membership.
- Profile privacy projection separately controls profile, location, timezone, activity and media.
- Public profile activity RPC filters every result through `can_view_channel` and privacy projection.

The local/mock helper previously treated a public-read visitor as allowed to browse the full member list. This diverged from hosted RLS and exposed member search/profile entry points. The hardening change now:

- sets visitor `canViewMemberList` false;
- hides the MemberSidebar and prevents its toggle from opening the directory;
- removes visitor people-search enumeration through the existing access flag;
- retains only minimal visible-message author records so public messages remain renderable;
- strips author status text/bio and marks presence offline in that local projection;
- removes non-Member role definitions from the visitor-rendered community projection.

Full profile access remains subject to `profilePrivacyService`; visitor activity/media require a trusted relationship and visible channels.

### Mentions, stories and events

- App-level mock items are filtered by community access and `canViewChannel` before Mention Feed rendering.
- Stories/events with a channel are filtered by the same channel decision.
- Community-only stories/events require membership or approved public content.
- Mention ranking receives an already filtered list; the ranking utility also supports an access predicate.

Production Mention Feed/Stories integration must repeat these filters in the server query/RLS. Client filtering is not sufficient and private items must never be returned.

### Search, saved content and deep links

- Local search skips communities without member/public-read access and filters channel/message/media/mention/saved results through `canViewChannel`.
- Visitor people results are now suppressed because member-directory access is false.
- Message jump resolves community, channel visibility, message/channel match and deleted state with a generic unavailable response.
- Production search RPC must enforce the same policy before returning labels/previews.

## Safe public data projection

Allowed visitor fields:

- Community ID, approved name/description/icon/accent, public category and aggregate member-count band.
- Public channel ID/name/type/topic when approved.
- Public message ID, bounded body/render data, author public display projection and timestamp.
- Clean/non-quarantined attachment metadata needed for rendering plus authorized delivery URL.
- Public rules and join policy.

Denied visitor fields:

- Private/unlisted community existence or internal moderation/listing state.
- Private channel IDs, names, topics, counts, messages, reactions, presence or voice-room state.
- Full community member directory, offline list, role hierarchy/permission JSON or staff-only profiles.
- Profile location/timezone/activity/media outside privacy projection.
- Invite codes, audit/report/appeal/abuse logs, bans or internal owner data.
- Pending/quarantined attachment paths, raw storage paths and signed URL internals.
- Private mentions, notifications, saved items or search labels/previews.

## UI behavior

- CommunitySidebar lists only public-readable non-private channels.
- A compact read-only notice explains that joining is required to participate.
- Composer and reply/reaction/upload actions are disabled with Join Community action.
- Member directory remains closed for visitors; the header control explains joining is required.
- Private/inaccessible deep links show one generic unavailable/access state and do not switch active channel.
- Leaving a public community immediately returns the user to visitor projection; leaving a private community removes access.
- No page-level/mobile fallback is introduced.

## Required RLS test matrix

### Identity roles

- Anonymous.
- Authenticated visitor.
- Member.
- Admin/owner.
- Banned/timed-out former/current member.
- User from another community.

### Community/channel combinations

- Public + public-read enabled/disabled.
- Private.
- Public non-private channel with public-read enabled/disabled.
- Private channel in public community.
- Deleted/archived channel/resource.

### Read cases

1. Community metadata includes only allowed fields.
2. Channel list excludes private/non-public-readable rows and category-derived leaks.
3. Direct channel/message ID fetch and deep link deny identically.
4. Message replies/reactions do not reveal an inaccessible parent/author/channel.
5. Attachment metadata, thumbnail/full delivery and storage object deny private/quarantined files.
6. Search, saved messages, notifications, mentions, stories, profile activity/media and exports exclude private rows.
7. Member/profile queries do not enumerate community members for visitor.
8. Realtime join/broadcast/postgres-change subscriptions cannot enter private rooms or receive private events.
9. Voice token/active-room endpoints deny visitors unless a separately approved public voice policy exists.

### Write cases

10. Visitor cannot send/edit/delete/reply/react/upload/mark channel read or create voice presence.
11. Visitor cannot modify community/channel/member/role/invite/report-review state.
12. Public join creates only default Member through the authoritative flow and is idempotent/rate-limited.
13. A failed/blocked join leaves visitor permissions unchanged.

### Revocation/concurrency

14. Member leave/ban/role change evicts realtime rooms and invalidates cached/private active view.
15. Public-to-private/channel-to-private change removes visitor access immediately.
16. Short-lived attachment URLs expire and cannot be refreshed after access loss.

## Automated and manual validation

- `supabase test db --file supabase/tests/rls/community_access_boundaries.sql`
- `supabase test db --file supabase/tests/rls/message_ownership_and_storage.sql`
- Hosted anonymous/visitor negative tests against the deployed migration set.
- Two-client realtime test for visibility change/leave/ban.
- Packaged desktop test for public channel browsing, disabled composer, join action and member-directory denial.

Supabase CLI is not currently available on this workstation, so local pgTAP/hosted RLS execution remains an external evidence gap. Existing SQL fixtures are not a substitute for applied hosted-policy validation.

## Remaining risks and next actions

- Task 261 documented that stored role permission, renderer and SQL decisions are not yet canonical; do not add overrides before parity work.
- Production Mention Feed/Stories/Profile Activity queries must be implemented and RLS-tested in their dedicated tasks.
- Storage signed-URL/private object access needs hosted provider tests.
- Public message author projection needs a dedicated server DTO so it does not depend on broad profile SELECT.
- Realtime room authorization and access-loss eviction require staging proof.
- Public join must not remain a broad direct table insert path once authoritative RPC hardening lands.

## Release blocker rule

Any private community/channel/message/attachment/profile activity/mention appearing for anonymous, visitor or cross-community fixtures is a P0 release blocker. Disable public read server-side and hide its entry points until corrected; never weaken RLS to restore UI functionality.
