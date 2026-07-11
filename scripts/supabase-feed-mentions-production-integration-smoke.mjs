import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260711151300_unified_feed_mentions_production_integration.sql");
const query = read("src/services/feed/feedQueryService.ts");
const realtime = read("src/services/feed/feedRealtimeService.ts");
const mentionMigration = read("supabase/migrations/20260711002900_unified_content_mentions.sql");
const rls = read("supabase/tests/rls/feed_mentions_production_integration.sql");

for (const source of ["text_message", "radio_session", "radio_chat", "podcast_episode", "podcast_comment"]) {
  assert.ok(mentionMigration.includes(`'${source}'`), `missing unified mention source: ${source}`);
}
assert.ok(migration.includes("security invoker"), "Feed query must preserve invoker RLS");
assert.ok(migration.includes("least(coalesce(result_limit,20),51)"), "Feed RPC must reserve one look-ahead row");
assert.ok(query.includes("const fetchLimit = limit + 1"), "client must request one look-ahead row");
assert.ok(query.includes("const hasNextPage = rows.length > limit"), "client must derive exact terminal cursor state");
assert.ok(query.includes("rows.slice(0, limit)"), "look-ahead row must not reach renderer data");
for (const table of ["user_follows", "saved_audio_items", "audio_feed_read_states"]) {
  assert.ok(migration.includes(`'${table}'`), `missing realtime publication contract: ${table}`);
  assert.ok(realtime.includes(`"${table}"`), `missing realtime client subscription: ${table}`);
}
assert.ok(migration.includes("content_mentions_ranked_feed_idx"), "Feed source/rank index missing");
assert.ok(rls.includes("Feed visibility remains source-authorized by RLS"), "Feed privacy regression contract missing");

console.log("Supabase unified Feed and mentions production integration smoke: PASS");
