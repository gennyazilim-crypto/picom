# Reaction analytics-safe summaries

Picom exposes reaction aggregates, not reactor directories. `list_message_reaction_summaries` accepts at most 100 message IDs and returns up to eight emojis per visible message with only count and the caller's own reacted state. The `(message_id, emoji, user_id)` index supports the grouped read.

`set_message_reaction` is idempotent, member-only, validates emoji length/control characters, and returns the authoritative aggregate. Renderer code cannot insert/delete reaction rows directly. Direct SELECT is limited to the caller's own rows, while all-user counts remain available only through the aggregate function.

Mention Feed consumes the same aggregate function and renders the top four emojis. No API returns other user IDs, per-user reaction history, message content analytics, or behavioral profiles.

Validation:

- `npm run reactions:summaries:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- Isolated pgTAP: `supabase/tests/rls/reaction_analytics_safe_summaries.sql`
