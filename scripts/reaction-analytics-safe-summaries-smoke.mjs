import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("supabase/migrations/20260710206000_reaction_analytics_safe_summaries.sql","utf8");
const service=readFileSync("src/services/reactionService.ts","utf8");
const app=readFileSync("src/App.tsx","utf8");
const store=readFileSync("src/state/useLocalMessageState.ts","utf8");
const feed=readFileSync("src/services/mentionFeedService.ts","utf8");
const test=readFileSync("supabase/tests/rls/reaction_analytics_safe_summaries.sql","utf8");

for(const marker of ["list_message_reaction_summaries","set_message_reaction","emoji_rank <= 8","reacted_by_current_user","revoke insert, delete on public.message_reactions","message_reactions_select_own_visible_message","idx_reactions_message_emoji_user"]) assert.ok(migration.includes(marker),`missing migration marker: ${marker}`);
assert.ok(!service.includes('.from("message_reactions")'),"renderer service must not read raw reactor rows");
assert.ok(service.includes('rpc("list_message_reaction_summaries"'),"service must batch aggregate reads");
assert.ok(service.includes('rpc("set_message_reaction"'),"service must use aggregate mutation RPC");
assert.ok(app.includes("setLocalReactionSummary"),"App must reconcile authoritative aggregate state");
assert.ok(store.includes("slice(0, 8)"),"message summaries must remain bounded");
assert.ok(feed.includes("slice(0, 4)"),"feed summaries must show only top emojis");
for(const marker of ["aggregate count includes permitted reactors","direct table read exposes no other reactor identities","private message summary is not leaked"]) assert.ok(test.includes(marker),`missing pgTAP coverage: ${marker}`);
console.log("Reaction analytics-safe summaries smoke: PASS");
