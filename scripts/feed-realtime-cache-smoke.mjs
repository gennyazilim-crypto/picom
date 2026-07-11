import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const requireText = (source, value, label) => {
  if (!source.includes(value)) throw new Error(`${label}: missing ${value}`);
};
const rejectText = (source, value, label) => {
  if (source.includes(value)) throw new Error(`${label}: forbidden ${value}`);
};

const migration = read("supabase/migrations/20260711148200_feed_realtime_unread_projection.sql");
const realtime = read("src/services/feed/feedRealtimeService.ts");
const mentionCache = read("src/services/feed/feedMentionCacheService.ts");
const query = read("src/services/feed/feedQueryService.ts");
const mentionService = read("src/services/mentionFeedService.ts");
const app = read("src/App.tsx");

requireText(migration, "with (security_invoker = true)", "RLS-invoker Feed projection");
requireText(migration, "end as is_unread", "authoritative unread projection");
requireText(migration, "pg_publication_tables", "idempotent realtime publication");
requireText(migration, "public.can_view_message(message.id)", "source authorization");
requireText(realtime, '"content_mentions"', "unified mention subscription");
requireText(realtime, '"read_states"', "read reconciliation subscription");
requireText(realtime, '"user_follows"', "following tab reconciliation subscription");
requireText(realtime, '"audio_feed_read_states"', "audio read-state reconciliation subscription");
requireText(realtime, '"saved_audio_items"', "audio saved-state reconciliation subscription");
requireText(realtime, '"radio_sessions"', "Radio subscription");
requireText(realtime, '"podcast_episode_comments"', "Podcast comment subscription");
requireText(realtime, "setTimeout(() =>", "event coalescing");
requireText(realtime, "120", "bounded realtime debounce");
rejectText(realtime, "preview:", "diagnostics content leakage");
rejectText(realtime, "body:", "diagnostics content leakage");
requireText(mentionCache, "const MAX_ITEMS = 200", "bounded mention cache");
requireText(mentionCache, "deduplicated.set(item.messageId", "message deduplication");
requireText(query, "const PAGE_CACHE_LIMIT = 16", "bounded pagination cache");
requireText(query, "PAGE_CACHE_STALE_MS", "stale cache fallback");
requireText(query, "bypassFreshCache", "authoritative refresh bypass");
requireText(mentionService, "isUnread: row.is_unread", "unread mapping");
requireText(app, "feedRealtimeService.subscribe", "App realtime lifecycle");
requireText(app, "feedQueryService.invalidateCache", "query cache invalidation");
requireText(app, "refreshInFlight", "duplicate refresh prevention");

console.log("Feed realtime, unread, and cache contract passed.");
