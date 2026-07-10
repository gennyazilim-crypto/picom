# Mention Feed Supabase production integration

## Implemented foundation

- `message_mentions` normalizes message-to-mentioned-user references without copying message content.
- `user_follows` remains the existing relationship table; SELECT is now limited to rows involving the current user.
- `mention_feed_view` is `security_invoker` and requires `can_view_message` for every row.
- Deleted messages and blocked authors are excluded before results reach the renderer.
- Attachments are included only when attached, clean/development-skipped and backed by a non-null approved URL; suspicious/pending/private-delivery-only files stay out.
- Reactions are aggregate JSON; no unrelated reactor list is returned.
- `list_mention_feed` provides stable `(created_at, message_id)` cursor ordering and executes as the caller.
- `mentionFeedService` is the only renderer data boundary and preserves mock pagination.
- Supabase App startup loads feed/following state through services; components do not query Supabase.

## Current intentional limitations

- Trusted mention extraction/population is Task 269. Until that migration/service runs, existing messages do not automatically gain `message_mentions` rows.
- Per-item read state is a Task 276 dependency; loaded production items currently begin unread in renderer state.
- Comment preview/count production modeling is Task 273; this view returns zero/empty placeholders.
- View counts remain zero; no invasive impression analytics was added.
- Feed attachment URLs use the currently approved row URL only. Private signed delivery integration must replace this safely where required.
- Reactions/save/read interactions retain their existing local/service paths; this task changes the production read source, not every feed mutation.

## RLS behavior

- Anonymous users cannot select the view or execute the list function.
- Authenticated users see mention rows only when they can view the linked message/channel.
- Private-channel mention/message/attachment data is therefore absent for visitors and ordinary members without access.
- Normal authenticated clients have no insert/update/delete grant on `message_mentions`; a trusted extraction path will own writes.
- Follow classification can read only the current user's relationship rows.
- Blocking removes reciprocal follows and the feed view additionally excludes blocked authors.

## Validation

Local/static:

- `npm run mentions:supabase:smoke`
- `npm run mentions:ranking:test`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

Hosted/CLI required:

- `supabase test db --file supabase/tests/rls/mention_feed_access.sql`
- Apply migrations to a disposable staging project and repeat visitor/member/owner queries.
- Confirm Realtime/publication configuration does not publish `message_mentions` outside authorized needs.

Supabase CLI is unavailable on the current workstation; SQL test execution remains required external evidence and is not reported as passing.
