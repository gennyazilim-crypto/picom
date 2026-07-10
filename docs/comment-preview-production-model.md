# Comment preview production model

## Product decision

Mention Feed comments are derived from ordinary Picom message replies. Picom does not introduce a separate feed-comment table, identity graph, notification stream, or social posting surface. This keeps discussion anchored to a community channel and within the approved Full MVP message-reply boundary.

## Projection

For each visible Mention Feed parent, `mention_feed_view` derives:

- total visible, active same-channel replies;
- unique visible commenter IDs for the existing compact avatar stack;
- the two newest previews with ID, author ID, a 180-character plain-text body, and timestamp.

Deleted replies, thread messages, blocked authors, cross-channel rows, and replies the caller cannot view are excluded. No HTML is rendered and no extra profile data is embedded.

## Security

The view remains `security_invoker` and explicitly calls `can_view_message` for both parent and reply rows. Task 270's same-channel reply constraint prevents a public feed item from referencing private-channel content. RLS, not UI filtering, is authoritative.

## Validation

- `npm run feed:comments:production:smoke`
- `npm run mentions:supabase:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- Isolated pgTAP: `supabase/tests/rls/comment_preview_production_model.sql`
