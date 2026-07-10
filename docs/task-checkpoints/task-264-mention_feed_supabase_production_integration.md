# Task 264 checkpoint: Mention Feed Supabase production integration

- Added `message_mentions`, participant-scoped `user_follows` SELECT, RLS-invoker `mention_feed_view` and cursor-paginated `list_mention_feed`.
- Added a typed `mentionFeedService` with mock and Supabase paths; renderer components remain backend-agnostic.
- Integrated authenticated Supabase startup loading for feed items and the current user's follows.
- Added pgTAP access fixtures plus a local static smoke contract and database type placeholders.
- Kept private/deleted/blocked content out and left extraction, read state and comment modeling to their dedicated tasks.

Validation: `npm run mentions:supabase:smoke`, `npm run mentions:ranking:test`, `npm run mock:smoke`, `npm run typecheck` and `npm run build` were run. Supabase pgTAP/hosted RLS execution remains pending because the CLI/environment is unavailable.
