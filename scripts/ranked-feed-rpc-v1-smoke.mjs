import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("supabase/migrations/20260712203000_ranked_feed_rpc_v1.sql","utf8");
const types=readFileSync("src/services/supabase/database.types.ts","utf8");
const rls=readFileSync("supabase/tests/rls/ranked_feed_rpc_v1.sql","utf8");
const explain=readFileSync("scripts/explain-ranked-feed-v1.sql","utf8");
for(const marker of [
  "public.get_feed_page(","feed_tab not in('feed','friends')","visible_items as materialized","public.can_view_feed_item(item.id)",
  "signal.raw_score>=4","signal.external_supporter_count>=1","signal.direct_mention or","power(2::numeric","/48",
  "public.friendships","cursor_group_priority","cursor_final_score","cursor_created_at","cursor_feed_item_id","effective_as_of",
  "candidate.author_position<=2","candidate.community_position<=4","candidate.consecutive_community_position<=2",
]) assert.ok(migration.includes(marker),`missing Feed RPC contract: ${marker}`);
for(const forbidden of ["user_follows"," offset ","direct_messages","service_role"]) assert.ok(!migration.toLowerCase().includes(forbidden),`forbidden Feed RPC dependency: ${forbidden}`);
assert.ok(types.includes("get_feed_page:"),"database RPC type missing");
assert.ok(rls.includes("direct mention guarantee")&&rls.includes("keyset only"),"RLS/query contract missing");
assert.ok(explain.includes("explain (analyze,buffers,format text)")&&explain.includes("public.get_feed_page"),"staging-safe EXPLAIN script missing");
console.log("Ranked access-aware Feed RPC V1 structural smoke: PASS");

