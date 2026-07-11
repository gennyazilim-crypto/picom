# Feed Query, Ranking, and Pagination

`unified_content_feed_view` groups visible `content_mentions` rows by canonical source and runs with `security_invoker`, so source RLS applies before aggregation. `list_ranked_unified_feed` returns Text, Radio, Radio-chat, Podcast-episode, and Podcast-comment mentions in one request; the renderer performs no per-card queries.

`popular` includes every visible source. `following` requires a persisted `user_follows` relation to the source author/host or a mentioned user. Ranking uses bounded unread, follow, aggregate reaction/comment/listener, source-kind, and seven-day recency signals. It stores no clickstream, fingerprint, private listener identity, or invasive behavior profile. The aggregate helper rechecks source visibility and returns counts only.

Pagination is keyset-based: score descending, source time descending, deterministic feed UUID descending. The cursor carries all keys and a fixed ranking epoch, keeping recency stable across one refresh. Refresh starts a new epoch. Empty pages distinguish `no_visible_mentions` from `no_followed_mentions`.

The query relies on existing source indexes: `content_mentions_*`, the unique follows pair, `idx_read_states_user_channel`, saved-message/audio indexes, Radio/Podcast reaction indexes, Podcast comment index, and `podcast_progress_episode_idx`. Page size is capped at 50.

Run `npm run feed:query:smoke`. Live pgTAP at `supabase/tests/rls/unified_feed_query.sql` remains blocked without configured Supabase CLI/staging credentials.
