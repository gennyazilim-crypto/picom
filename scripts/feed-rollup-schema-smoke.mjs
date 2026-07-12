import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260712201000_feed_rollup_schema.sql", "utf8");
const databaseTypes = readFileSync("src/services/supabase/database.types.ts", "utf8");
const fixture = readFileSync("src/data/feedRollupSchemaFixtures.ts", "utf8");
const rls = readFileSync("supabase/tests/rls/feed_rollup_schema.sql", "utf8");
const notes = readFileSync("docs/feed-rollup-migration-notes.md", "utf8");

for (const table of ["feed_items", "feed_engagement_rollups", "feed_user_states", "feed_impressions"]) {
  assert.ok(migration.includes(`create table if not exists public.${table}`), `missing table ${table}`);
  assert.ok(databaseTypes.includes(`${table}:`), `missing generated type ${table}`);
  assert.ok(rls.includes(`'${table}'`), `missing RLS structural assertion ${table}`);
}
for (const marker of [
  "feed_items_source_unique",
  "feed_user_states_user_item_unique",
  "feed_impressions_session_item_unique",
  "force row level security",
  "public.can_view_feed_item",
  "source_type, source_id",
  "score_version, moderation_state",
  "user_id, last_seen_at",
]) assert.ok(migration.includes(marker), `missing migration contract: ${marker}`);

for (const forbidden of ["message_body", "raw_content", "full_body", "authorization", "access_token"]) {
  assert.ok(!migration.toLowerCase().includes(`${forbidden} `), `unsafe impression/rollup field: ${forbidden}`);
}
assert.ok(fixture.includes("satisfies Readonly"), "typed seed/mock parity fixture missing");
assert.ok(notes.includes("Forward-fix") && notes.includes("Do not roll back after production writes"), "migration recovery notes missing");
console.log("Feed rollup schema structural smoke: PASS");

