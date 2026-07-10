# Message mention extraction

## Contract

Picom clients submit message text only. They never submit mentioned user IDs and cannot write `message_mentions`. The database trigger `messages_sync_mentions` resolves and stores mention references in the same transaction as a message insert or edit.

Supported syntax:

- `@username` resolves a canonical, case-insensitive Picom username.
- `@"Display Name"` resolves a quoted display name only when exactly one member of the message community has that normalized display name.

Display names are quoted deliberately. Unquoted names containing spaces are ambiguous, and silently selecting the wrong account would enable spoofing.

## Security boundaries

- Candidates must be current members of `messages.community_id`.
- The message author cannot mention themselves.
- Ambiguous display names, unknown accounts, and users outside the community are ignored.
- Email-like text is not treated as a mention.
- A message produces at most 20 unique mention targets.
- Webhook-authored messages do not create user mentions until integration identity and consent rules are finalized.
- Normal `authenticated` and `anon` roles cannot execute the trigger function or mutate `message_mentions`.
- Mention reads remain protected by `can_view_message(message_id)`, so private-channel references are not disclosed to unauthorized users.

## Lifecycle

- Insert: the trigger derives the normalized mention set after the message row is accepted.
- Edit: all previous rows are deleted and the current body is re-derived atomically.
- Soft delete: all mention rows are removed.
- Hard delete: the foreign key cascade removes rows.
- Duplicate tokens collapse through the unique constraint and set-based extraction.

`mention_feed_view` and followed-story projections already read `message_mentions`, so their database source updates immediately. `message_mentions` is included in Supabase Realtime with full replica identity; clients must still subscribe through a service and treat RLS as authoritative. A future notification worker may consume authorized realtime/outbox events, but this task does not create a content-bearing notification copy.

## Validation

- Static contract: `npm run mentions:extraction:smoke`
- Existing feed contract: `npm run mentions:supabase:smoke`
- Isolated pgTAP: `supabase test db supabase/tests/rls/message_mentions_extraction.sql`

The pgTAP command requires the Supabase CLI and an isolated local test database. Never run it against production.
