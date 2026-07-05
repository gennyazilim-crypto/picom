import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  realtimeService: readFileSync(resolve(root, "src/services/supabase/realtimeService.ts"), "utf8"),
  realtimeHook: readFileSync(resolve(root, "src/hooks/useSupabaseMessageRealtime.ts"), "utf8"),
  localMessageState: readFileSync(resolve(root, "src/state/useLocalMessageState.ts"), "utf8"),
  sharedEvents: readFileSync(resolve(root, "packages/shared/src/events/index.ts"), "utf8"),
  doc: readFileSync(resolve(root, "docs/realtime-event-ordering.md"), "utf8"),
};

const checks = [
  [files.realtimeService.includes("RealtimeEventOrderingMetadata"), "ordering metadata type"],
  [files.realtimeService.includes("createRealtimeEventId"), "event id helper"],
  [files.realtimeService.includes("createRealtimeEventOrderingGuard"), "ordering guard"],
  [files.realtimeService.includes("duplicate_event"), "duplicate event decision"],
  [files.realtimeService.includes("older_than_delete"), "delete ordering decision"],
  [files.realtimeHook.includes("eventOrderingRef"), "hook ordering guard ref"],
  [files.realtimeHook.includes("message.deletedAt ? \"message:delete\" : \"message:update\""), "soft delete update classified"],
  [files.realtimeHook.includes("Supabase out-of-order realtime update ignored"), "out-of-order update logging"],
  [files.localMessageState.includes("shouldKeepDeletedMessage"), "local deleted message guard"],
  [files.sharedEvents.includes("eventId"), "shared realtime event id type"],
  [files.sharedEvents.includes("serverTimestamp"), "shared realtime timestamp type"],
  [files.doc.includes("Deleted messages should not reappear"), "delete safety documented"],
  [files.doc.includes("sequence placeholder"), "sequence placeholder documented"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length > 0) {
  throw new Error(`Realtime event ordering smoke test failed: ${failed.join(", ")}`);
}

console.log("Realtime event ordering smoke test passed.");
