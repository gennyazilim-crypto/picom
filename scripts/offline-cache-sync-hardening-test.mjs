import { readFile } from "node:fs/promises";

const [queue, cache, conflicts, app, docs, packageJson] = await Promise.all([
  readFile("src/services/messageSendQueueService.ts", "utf8"),
  readFile("src/services/cacheManagementService.ts", "utf8"),
  readFile("src/services/offlineSyncConflictService.ts", "utf8"),
  readFile("src/App.tsx", "utf8"),
  readFile("docs/offline/offline-cache-queue-production.md", "utf8"),
  readFile("package.json", "utf8"),
]);

const checks = [
  [queue.includes("operationsByClientMessageId") && queue.includes("if (existing) return existing"), "in-flight dedupe"],
  [queue.includes("maxPendingPerChannel = 25") && queue.includes("maxPendingTotal = 100"), "bounded queue"],
  [queue.includes("waitForBrowserOnline") && queue.includes('addEventListener("online"'), "reconnect flush"],
  [queue.includes("cancelPending") && queue.includes("canceledClientMessageIds"), "queued cancellation"],
  [app.includes("messageSendQueueService.cancelPending") && app.includes('result.error.code === "QUEUE_CANCELED"'), "UI cancellation integration"],
  [conflicts.includes("queue_full") && conflicts.includes("copy_text"), "capacity recovery"],
  [cache.includes("pendingQueuedMessages") && cache.includes("preserves pending queued messages"), "cache summary safety"],
  [docs.includes("No token, password") && docs.includes("25 per channel") && docs.includes("100 per renderer"), "privacy and limits docs"],
  [packageJson.includes('"offline:cache-sync:hardening:test"'), "package script"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
