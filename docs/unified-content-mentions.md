# Unified Content Mentions

Picom normalizes mentions from text messages, Radio sessions/listener chat, Podcast episodes, and Podcast comments into `public.content_mentions`.

## Canonical source kinds

| Source kind | Canonical source ID | Navigation |
| --- | --- | --- |
| `text_message` | message ID | community/channel/message |
| `radio_chat` | message ID | Radio listener-chat channel/message |
| `radio_session` | Radio session ID | Radio community/session |
| `podcast_episode` | Podcast episode ID | Podcast episode |
| `podcast_comment` | Podcast comment ID | parent Podcast episode and comment |

Every row records community, optional channel, author/host, mentioned user, a bounded plain-text preview, source timestamps, and a non-authoritative visibility snapshot. The snapshot supports presentation only; RLS always recalculates access from the live source.

## Synchronization

- Existing normalized `message_mentions` rows drive text and Radio-chat records.
- Message edits, soft deletes, channel changes, and source reclassification reconcile existing rows.
- Radio title/description changes reconcile Radio-session mentions.
- Podcast publish/unpublish/archive, description edits, comment edits, and comment deletes reconcile Podcast mentions.
- Migration backfill runs the same reconciliation functions used by triggers.

## Access boundary

Clients have `SELECT` only. Trigger-owned rows cannot be forged from the renderer. `content_mentions_select_visible` delegates to the source access function:

- messages and Radio chat: `can_view_message`
- Radio sessions: `can_view_radio_session`
- Podcast episodes/comments: `can_view_podcast_episode`

Blocked-author pairs are excluded dynamically. Private source content therefore cannot become visible merely because a mention row exists. Components consume `unifiedContentMentionService`; they must not query the table directly.

## UI compatibility

`textMentionToUnified`, `audioMentionToUnified`, and `getUnifiedMentionNavigation` provide one contract while preserving the existing Mention Feed text cards and Audio feed cards. This task intentionally does not redesign those established surfaces.

## Validation

Run `npm run mentions:unified:smoke`. The pgTAP contract is `supabase/tests/rls/unified_content_mentions.sql`. Live pgTAP remains blocked until a configured Supabase CLI/staging environment is available; static validation does not claim hosted RLS evidence.
