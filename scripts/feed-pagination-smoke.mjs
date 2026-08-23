import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync("src/services/mentionFeedService.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const main = readFileSync("src/components/MentionFeedMain.tsx", "utf8");
const cache = readFileSync("src/services/feed/feedMentionCacheService.ts", "utf8");

assert.ok(service.includes("cursor_created_at"), "mention RPC must pass created_at cursor");
assert.ok(service.includes("cursor_message_id"), "mention RPC must pass message_id cursor");
assert.ok(service.includes("encodeCursor"), "service must encode stable cursor");
assert.ok(!/\boffset\b/.test(service), "mention feed must not use offset pagination");
assert.ok(app.includes("loadMoreMentionFeed"), "App must implement load more");
assert.ok(app.includes("mentionFeedCursor"), "App must keep page cursor");
assert.ok(app.includes("mentionFeedLoadingMore"), "App must track loading-more");
assert.ok(app.includes("mergePage"), "cache must merge cursor pages");
assert.ok(cache.includes("mergePage"), "cache mergePage helper required");
assert.ok(main.includes("feed-load-more"), "accessible Load more button required");
assert.ok(main.includes('translate("feed.loadMore")'), "Load more must use i18n");
assert.ok(main.includes("feed-pagination-footer"), "pagination footer required");
assert.ok(app.includes("mentionFeedLoadSeq"), "stale request cancellation required");

console.log("Feed cursor pagination smoke: PASS");
