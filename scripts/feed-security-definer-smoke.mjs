import { readFileSync, readdirSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`${label}: missing ${value}`);
}

function requireNot(source, value, label) {
  if (source.includes(value)) throw new Error(`${label}: forbidden ${value}`);
}

const mentionFeed = read("supabase/migrations/20260710199000_mention_feed_production.sql");
const ranked = read("supabase/migrations/20260711151300_unified_feed_mentions_production_integration.sql");
const engagement = read("supabase/migrations/20260711003000_unified_feed_query_ranking_pagination.sql");
const realtime = read("src/services/feed/feedRealtimeService.ts");
const deepLink = read("src/services/feed/feedMessageDeepLinkService.ts");
const app = read("src/App.tsx");
const policy = read("src/services/navigation/notificationNavigationPolicyService.ts");

requireText(mentionFeed, "security invoker", "list_mention_feed must be security invoker");
requireText(mentionFeed, "revoke all on function public.list_mention_feed", "anon revoke on list_mention_feed");
requireText(mentionFeed, "grant execute on function public.list_mention_feed", "authenticated grant on list_mention_feed");
requireText(mentionFeed, "users_are_blocked", "blocked-author exclusion in mention feed view");
requireText(ranked, "security invoker", "list_ranked_unified_feed must be security invoker");
requireText(ranked, "revoke all on function public.list_ranked_unified_feed", "anon revoke on ranked feed");
requireText(engagement, "security definer", "engagement helper is intentionally definer");
requireText(engagement, "can_view_content_mention(mention)", "definer engagement re-checks visibility");
requireText(engagement, "if not allowed then return query select 0,0,0", "definer fail-closed engagement");

const migrationNames = readdirSync(new URL("supabase/migrations", root))
  .filter((name) => /mention_feed|unified_feed|feed_mentions|feed_realtime|content_mentions/i.test(name));
for (const name of migrationNames) {
  const body = read(`supabase/migrations/${name}`);
  if (/create\s+(or\s+replace\s+)?function\s+public\.list_mention_feed/i.test(body)) {
    requireText(body, "security invoker", `${name}: list_mention_feed invoker`);
    requireNot(body, "security definer", `${name}: list_mention_feed must not be definer`);
  }
  if (/create\s+(or\s+replace\s+)?function\s+public\.list_ranked_unified_feed/i.test(body)
    && body.includes("security definer")
    && !body.includes("security invoker")) {
    throw new Error(`${name}: ranked feed revision lacks security invoker`);
  }
}

requireText(deepLink, "SERVER_DENIED", "server deny path");
requireText(deepLink, "BLOCKED_AUTHOR", "blocked author deny");
requireText(deepLink, "NON_MEMBER_PRIVATE", "private non-member deny");
requireText(deepLink, ".from(\"messages\")", "server message visibility probe");
requireText(deepLink, "deleted_at", "deleted message denial");
requireText(app, "feedMessageDeepLinkService", "App uses canonical feed deep-link service");
requireText(app, "openAuthorizedCommunityMessage", "authorized open helper");
requireText(app, "highlightMessageTemporarily", "exact highlight helper");
requireNot(app, "Message highlight is a placeholder.", "placeholder highlight toast removed");
requireText(policy, "author is blocked", "policy blocked-author deny");
requireText(policy, "channel is private", "policy private-channel deny");
requireText(realtime, "if (activeUnsubscribe)", "duplicate subscription teardown");
requireText(realtime, "reason === \"reconnect\"", "reconnect invalidation");
requireText(realtime, "120", "debounce coalescing");

console.log("Feed security definer / deep-link / realtime contract: PASS");
