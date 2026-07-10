import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hook=readFileSync("src/hooks/useSupabaseMessageRealtime.ts","utf8");
const service=readFileSync("src/services/supabase/realtimeService.ts","utf8");
const app=readFileSync("src/App.tsx","utf8");
const doc=readFileSync("docs/realtime-deduplication-hardening.md","utf8");

for(const marker of ["subscriptionGenerationRef","isCurrentSubscription","insertDeduperRef.current.clear()","eventOrderingRef.current.clear()","client.removeChannel(channel)","Supabase message realtime subscription removed","diagnostics.duplicate","diagnostics.stale"]) assert.ok(hook.includes(marker),`missing lifecycle marker: ${marker}`);
assert.ok((hook.match(/if \(!isCurrentSubscription\(\)\) return;/g)??[]).length>=4,"every event/status callback must reject stale subscriptions");
const diagnosticBlocks = [...hook.matchAll(/loggingService\.(?:logInfo|logWarn)\([\s\S]*?\);/g)].map((match) => match[0]).join("\n");
assert.ok(hook.includes("hasClientMessageId: Boolean")&&!diagnosticBlocks.includes("clientMessageId: message.clientMessageId"),"diagnostics must not log raw client message IDs");
assert.ok(service.includes("seenMessageIds")&&service.includes("seenClientMessageIds"),"insert deduper must cover both identifiers");
assert.ok(service.includes("seenEventIds")&&service.includes("duplicate_event"),"event IDs must remain bounded and deduplicated");
assert.ok(app.includes('activeView === "community"'),"message subscription must stop outside community view");
assert.ok(doc.includes("two desktop windows")&&doc.includes("No duplicate"),"two-window verification must be documented");
console.log("Realtime event deduplication hardening smoke: PASS");
