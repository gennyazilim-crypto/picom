# Supabase Unified Feed and Mentions Integration

## Production path

Picom reads the unified Text, Radio, and Podcast Feed through the `list_ranked_unified_feed` security-invoker RPC. Components do not query Supabase directly. Mention extraction remains source-aware for Text messages, Radio sessions/chat, Podcast episodes, and Podcast comments.

The RPC preserves source-table RLS through `unified_content_feed_view` and `can_view_content_mention`. A Feed row is never an authorization grant: losing access to its community, channel, Radio session, or Podcast source removes it from subsequent reads.

## Stable pagination

The renderer requests one look-ahead row and displays at most 50 rows. A next cursor is emitted only when that extra row exists. Ranking epoch, score, creation time, and Feed item ID form the stable keyset boundary. This prevents duplicate rows and false terminal cursors without offset pagination.

## Realtime reconciliation

Feed cache invalidation covers content, engagement, read, save, and follow changes. `user_follows`, `saved_audio_items`, and `audio_feed_read_states` use complete replica identities and are included in `supabase_realtime`. Events carry IDs only; message or profile content is not written to diagnostics.

Realtime is an invalidation signal rather than an authorization bypass. After an event, Picom re-runs the RLS-aware query. Subscription cleanup remains owned by `feedRealtimeService`.

## Index and validation

`content_mentions_ranked_feed_idx` supports source-filtered chronological scans. Existing recipient, community, source lookup, follow, read-state, and saved-item indexes remain in force.

Run structural checks with:

```powershell
node scripts/supabase-feed-mentions-production-integration-smoke.mjs
npm run feed:query:smoke
npm run feed:realtime:cache:smoke
npm run feed:full-mvp:qa
npm run supabase:qa
```

Run the pgTAP contract after installing and starting the Supabase CLI:

```powershell
supabase test db --file supabase/tests/rls/feed_mentions_production_integration.sql
```
