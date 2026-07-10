import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260710209000_unread_read_state_production.sql");
const service = read("src/services/supabase/readStateService.ts");
const app = read("src/App.tsx");
const list = read("src/components/MessageList.tsx");
const localState = read("src/state/useLocalMessageState.ts");
const realtime = read("src/hooks/useSupabaseMessageRealtime.ts");

for (const marker of ["mark_channel_read", "get_my_community_unread_state", "read_states_select_own_visible_channel", "public.can_view_channel(channel_id)", "message_mentions"]) assert.ok(migration.includes(marker), `missing migration boundary: ${marker}`);
assert.ok(service.includes('client.rpc("mark_channel_read"') && service.includes('client.rpc("get_my_community_unread_state"'), "read-state writes and summaries must stay behind RPCs");
assert.ok(!service.includes('.from("read_states")'), "renderer service must not bypass the RLS-safe RPC contract");
assert.ok(app.includes("isActiveMessageListNearBottom") && app.includes("setCommunityUnreadState") && app.includes("subscribeCommunityWide: true"), "app must integrate near-bottom and community unread state");
assert.ok(list.includes("READ_BOTTOM_THRESHOLD_PX") && list.includes("onScroll={handleScroll}"), "message list must report near-bottom state");
assert.ok(localState.includes("(channel.mentions ?? 0) + (mentionCount ?? 0)"), "mention counts must accumulate separately from unread state");
assert.ok(realtime.includes("subscribeCommunityWide") && realtime.includes("community_id=eq.${communityId}"), "inactive visible channels need realtime insert coverage");
console.log("Unread and read-state production smoke: PASS");
