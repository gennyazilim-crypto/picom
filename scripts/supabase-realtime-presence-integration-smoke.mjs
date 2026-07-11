import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path,"utf8");
const topics = read("src/services/supabase/realtimeService.ts");
const auth = read("src/services/supabase/supabaseClient.ts");
const migration = read("supabase/migrations/20260711151500_realtime_presence_typing_full_mvp.sql");
const directTyping = read("src/hooks/useDirectTypingBroadcast.ts");
const communityMessages = read("src/hooks/useSupabaseMessageRealtime.ts");
const presence = read("src/services/friends/friendPresenceService.ts");
const diagnostics = read("src/services/supabase/realtimeDiagnosticsService.ts");

for(const builder of ["communityMessages","directTyping","directActive","directList","friendPresence","feed","radioCatalog","podcastCatalog"]) assert.ok(topics.includes(`${builder}:`),`missing canonical topic builder: ${builder}`);
assert.ok(directTyping.includes("realtimeChannelNames.directTyping"),"DM typing must use canonical private topic");
assert.ok(communityMessages.includes("realtimeChannelNames.communityMessages"),"community-wide unread subscription must use canonical topic");
assert.ok(migration.includes("dm:conversation:")&&migration.includes("direct_conversation_participants"),"DM private topic authorization missing");
assert.ok(migration.includes("all-visible-channels")&&migration.includes("subject_effective_community_permission"),"community/private channel authorization missing");
assert.ok(auth.includes('event === "TOKEN_REFRESHED"')&&auth.includes("realtime.setAuth(session.access_token)"),"Realtime token refresh sync missing");
assert.ok(auth.includes("removeAllChannels()"),"sign-out subscription cleanup missing");
assert.ok(presence.includes("activePresenceSubscriptions")&&presence.includes("pendingOfflineTimer"),"presence resubscribe race guard missing");
assert.ok(diagnostics.includes("activeChannelCount")&&diagnostics.includes("duplicateChannelCount")&&!diagnostics.includes("access_token"),"safe channel diagnostics missing");

console.log("Supabase Realtime presence, typing, unread, authorization, and cleanup smoke: PASS");
