import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/hosted-staging-realtime-validation.mjs", "utf8");
const service = readFileSync("src/services/supabase/realtimeService.ts", "utf8");
const messageHook = readFileSync("src/hooks/useSupabaseMessageRealtime.ts", "utf8");
const typingHook = readFileSync("src/hooks/useSupabaseTypingBroadcast.ts", "utf8");
const presenceHook = readFileSync("src/hooks/useSupabasePresenceChannel.ts", "utf8");
const directTypingHook = readFileSync("src/hooks/useDirectTypingBroadcast.ts", "utf8");
const authorization = readFileSync("supabase/migrations/20260711151500_realtime_presence_typing_full_mvp.sql", "utf8");

const checks = [
  [runner.includes("STAGING_ONLY") && runner.includes("service[_-]?role"), "staging-only public-key guard"],
  [runner.includes('INSERT') && runner.includes('UPDATE') && runner.includes('DELETE'), "message mutation event matrix"],
  [runner.includes('eventCounts.a') && runner.includes('eventCounts.b'), "two-client exact event counts"],
  [runner.includes('event: "typing"') && runner.includes('presenceState()'), "typing and presence checks"],
  [runner.includes("realtime.disconnect()") && runner.includes("realtime.connect()"), "socket reconnect"],
  [runner.includes("removeChannel") && runner.includes("getChannels().length"), "subscription cleanup assertion"],
  [service.includes("seenMessageIds") && service.includes("seenClientMessageIds"), "runtime message dedupe"],
  [messageHook.includes("client.removeChannel(channel)"), "message hook cleanup"],
  [typingHook.includes("client.removeChannel(channel)"), "typing hook cleanup"],
  [presenceHook.includes("client.removeChannel(channel)") && presenceHook.includes("channel.untrack()"), "presence cleanup"],
  [directTypingHook.includes("realtimeChannelNames.directTyping") && authorization.includes("dm:conversation:"), "authorized private DM typing topic"],
  [authorization.includes("all-visible-channels") && authorization.includes("viewPrivateChannels"), "community-wide and private-channel topic authorization"],
];
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Realtime staging contract failed: ${failed.join(", ")}`);
console.log("Realtime staging two-client, dedupe, reconnect, and cleanup contract passed.");
