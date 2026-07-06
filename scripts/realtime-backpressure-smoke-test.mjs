import fs from "node:fs";

const doc = fs.readFileSync("docs/realtime-backpressure.md", "utf8");
const realtimeService = fs.readFileSync("src/services/supabase/realtimeService.ts", "utf8");
const typing = fs.readFileSync("src/hooks/useSupabaseTypingBroadcast.ts", "utf8");
const presence = fs.readFileSync("src/hooks/useSupabasePresenceChannel.ts", "utf8");

const requiredDoc = [
  "Typing",
  "Presence",
  "Reactions",
  "Message sends",
  "Backend policy placeholder",
  "Frontend policy",
  "Degradation order",
];
const missingDoc = requiredDoc.filter((item) => !doc.includes(item));
const missingSource = [
  realtimeService.includes("REALTIME_TYPING_THROTTLE_MS") ? "" : "REALTIME_TYPING_THROTTLE_MS",
  realtimeService.includes("REALTIME_PRESENCE_TRACK_THROTTLE_MS") ? "" : "REALTIME_PRESENCE_TRACK_THROTTLE_MS",
  typing.includes("shouldThrottleRealtimeSend") ? "" : "typing throttle helper",
  presence.includes("pendingPresenceTrackTimerRef") ? "" : "presence pending timer",
  presence.includes("REALTIME_PRESENCE_TRACK_THROTTLE_MS") ? "" : "presence throttle constant",
].filter(Boolean);

if (missingDoc.length > 0 || missingSource.length > 0) {
  console.error(`Realtime backpressure missing doc=${missingDoc.join(", ")} source=${missingSource.join(", ")}`);
  process.exit(1);
}

console.log("Realtime backpressure smoke test passed.");
