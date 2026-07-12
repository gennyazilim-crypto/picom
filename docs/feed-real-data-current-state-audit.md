# Feed Real-Data Current-State Audit

Date: 2026-07-12  
Baseline: `1c8d2b2`  
Scope: Task 677, read-only architecture audit

## Executive verdict

Picom has useful production foundations for an access-aware Feed, but the current implementation is not the requested Feed Algorithm V1.

- Supabase mode does not intentionally fall back to mock data in the Feed services.
- Existing source-specific access functions and RLS provide a strong privacy base.
- The production unified query is mention-centric. It cannot nominate ordinary popular content that has no mention row.
- The production query and UI still use one-way follows and the `following` tab. The approved product contract requires accepted friends and the `friends` tab.
- The current ranking formula is not Score V1 and reads engagement at query time instead of from event-driven rollups.
- Direct accessible mentions are not modeled as a guaranteed candidate group ahead of thresholded normal content.
- Message views do not have a canonical unique-view event source suitable for Score V1.

The Feed must therefore remain release-blocked until Tasks 678-688 replace the candidate, scoring, rollup, query, service, UI-state, abuse-control, and hosted-evidence layers.

## Current renderer data paths

| Surface | Mock path | Supabase path | Finding |
| --- | --- | --- | --- |
| Legacy mention feed | `mockMentionItems` through `mentionFeedService` | `list_mention_feed` RPC | The service chooses by configured data mode and does not silently fall back in Supabase mode. The contract is message/mention and follow based. |
| Unified feed | `mockUnifiedContentMentions` through `feedQueryService` | `list_ranked_unified_feed` RPC | The service boundary is reusable, but the query modes are `popular` and `following`, and the scoring contract is obsolete. |
| App bootstrap | Local `mockMentionItems` initializer | Replaced after asynchronous load | A Supabase session can briefly render mock-shaped state before the first production response. Production bootstrap must use an explicit loading/empty state. |
| Read/save | Local sets in mock mode | Feed/query RPC projections and existing saved/read tables | State exists, but reconciliation and source-wide semantics are incomplete. |
| Realtime | Feed realtime service and cache invalidation | Supabase Realtime publications | Current invalidation follows the old mention/follow query shape and does not consume Score V1 rollup changes. |
| Cards | Mention cards plus `UnifiedFeedList` | Service DTOs | Text, radio, and podcast rendering exists, but there is no single production card contract for all required source classes and metrics. |

UI components do not need direct Supabase calls. That boundary must be preserved in Tasks 683-686.

## Current production source model

`content_mentions` supports these source values:

- `text_message`
- `radio_session`
- `radio_chat`
- `podcast_episode`
- `podcast_comment`

The new contract calls the radio child source `radio_comment`; current code calls it `radio_chat`. Task 678 must resolve this with a backward-compatible canonical classification rather than creating two competing content types.

The table contains source identifiers, parent source, community/channel/author/recipient identifiers, a bounded preview, timestamps, and visibility context. Its triggers exclude deleted messages, webhook messages, cancelled radio sessions, unpublished podcast episodes, and deleted podcast comments. `can_view_content_mention` delegates to source-specific access checks.

This is appropriate for direct mention discovery, but it is not a complete candidate index. Ordinary accessible messages, radio content, and podcast content without a mention never enter the current unified feed.

## Algorithm input inventory

| Required input | Current source | Readiness | Gap or risk |
| --- | --- | --- | --- |
| Text body | `messages` | Available | Must not be copied into analytics or impression tables. |
| Message media | `attachments` | Available | Classification must use accepted MIME/status/scan state and support image and video combinations. |
| Radio session | Radio session/listener tables | Available | Needs canonical content adapter and access-aware visibility. |
| Radio comment | Chat/message-backed radio records | Partial | Naming is `radio_chat`; parent/source rules need normalization. |
| Podcast episode | Podcast episode tables | Available | Must exclude drafts, unpublished, deleted, or inaccessible items. |
| Podcast comment | Podcast comment tables | Available | Must preserve episode visibility and deletion rules. |
| Unique external reactors | Message/radio/podcast reaction tables | Partial | Current queries aggregate counts at read time. Self, bot, blocked, banned, and deactivated actors are not normalized in one rollup pipeline. |
| Unique external commenters | Replies/comments | Partial | Message replies exist; source-specific comment identity and genuine-extra-reply cap are not unified. |
| Saves | `saved_messages` and audio save state | Partial | Requires a source-neutral event key and self-save exclusion. |
| Unique views | Legacy projection and audio state | Missing for messages | No canonical message unique-view event table was found. Existing zero/synthetic counts are not Score V1 evidence. |
| Accepted friendship | `friendships` normalized low/high pair | Available | Current Feed uses `user_follows` instead. Friendship may add relevance but never bypass visibility. |
| Direct mention | `content_mentions` | Available | Must be guaranteed when accessible, independent of the normal-content popularity threshold. |
| Unread state | Message/audio read state | Partial | Needs source-neutral projection and read reconciliation. |
| Recent community relevance | Membership/activity context | Derivable | Requires a bounded, privacy-safe definition in the ranking RPC. |
| Account/moderation state | Profiles, moderation, blocking helpers | Available across domains | Must be applied before aggregation so ineligible activity never contributes. |

## Existing ranking and pagination

`list_ranked_unified_feed` currently:

- computes engagement through query-time lateral aggregation;
- derives `is_follow_related` from `user_follows`;
- uses modes `popular` and `following`;
- applies a legacy square-root/logarithmic/time-window ranking formula;
- paginates by score, source creation time, and feed item ID;
- holds a ranking epoch for a page sequence.

The requested algorithm instead requires:

- guaranteed accessible direct mentions as the first candidate group;
- normal candidates only when `raw_score >= 4` and at least one external supporter exists;
- exact base and engagement caps from Score V1;
- accepted-friend relevance, not follow relevance;
- query-time exponential freshness with a 48-hour half-life;
- a stable `as_of` cursor carrying group priority, final score, creation time, and feed item ID;
- diversity caps after ranking normal cards.

## Follow-system dependencies that must leave the Feed

The existing Feed stack still references `user_follows` in:

- legacy mention source classification;
- unified ranking and the `following` mode;
- followed stories;
- realtime publication/invalidation;
- onboarding/profile counters and adjacent social helpers.

Tasks 678-688 must remove follow semantics only from the new Feed path and its UI. Destructive removal of the legacy table is not required for this project slice because unrelated historical features may still reference it. No new Feed migration, service, or component may depend on it.

## Privacy and security assessment

### Safe foundations

- Source-specific `can_view_*` functions already centralize much of the access logic.
- `content_mentions` is protected by RLS and source visibility checks.
- Private community/channel content is not intentionally exposed through the current mention RPC.
- Direct messages are a separate domain and are not a Feed source.
- Block relationships are considered by existing access helpers.

### Required controls

- Filter candidates before ranking and pagination, not after returning rows.
- Revalidate visibility when serving cached pages and deep links.
- Never let accepted friendship reveal a private community, private channel, or blocked account.
- Exclude deleted/moderated content and banned/deactivated actors from both candidates and engagement rollups.
- Keep previews bounded and never persist full message bodies in rollup, event, view, or impression tables.
- Use invoker-facing RPCs with explicit grants and carefully isolated definer helpers only where needed.
- Prevent direct-message rows and attachments from entering any Feed source adapter.

## Performance and reliability assessment

- Query-time engagement aggregation will become increasingly expensive and unstable as reaction/comment tables grow.
- Mention-only candidate storage avoids a full scan but produces an incomplete product Feed.
- Existing page caching is tied to old modes and cursor fields; stale pages can conflict with realtime events.
- Existing ranking has no event idempotency contract, so a new rollup pipeline must define unique actor/event keys.
- Stable pagination needs one immutable `as_of` value per traversal and deterministic tie-breakers.
- A dedicated, bounded candidate/rollup path is preferable to scanning message, radio, and podcast tables on every page.

## Release decision

Current status: **BLOCKED for the new real-data Feed algorithm**.

Mock mode remains useful for isolated UI development. Supabase production mode must not be presented as Score V1-complete until the Task 688 hosted evidence passes.

## Task dependency map

| Task | Deliverable | Depends on |
| --- | --- | --- |
| 678 | Canonical source and content classification | 677 |
| 679 | Shared Score V1 config/calculator and fixtures | 678 |
| 680 | Rollup/event/view schema and RLS | 678, 679 |
| 681 | Idempotent event triggers and aggregation | 680 |
| 682 | Access-aware candidate/ranking/keyset RPC | 679, 680, 681 |
| 683 | Production service/repository integration | 682 |
| 684 | Unified text/radio/podcast cards | 678, 683 |
| 685 | Feed/Friends tabs, stories, and filters | 683, 684 |
| 686 | Realtime, read/save, and cache reconciliation | 681, 683, 685 |
| 687 | Abuse, diversity, fairness, and privacy enforcement | 681, 682, 686 |
| 688 | Hosted database, algorithm, E2E, and release evidence | 678-687 |

