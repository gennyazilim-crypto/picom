import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  service: readFileSync(resolve(root, "src/services/offlineSyncConflictService.ts"), "utf8"),
  app: readFileSync(resolve(root, "src/App.tsx"), "utf8"),
  doc: readFileSync(resolve(root, "docs/offline-sync-conflict-resolution.md"), "utf8"),
};

const checks = [
  [files.service.includes("OfflineQueuedActionType"), "queued action type"],
  [files.service.includes("OfflineSyncConflictCode"), "conflict code type"],
  [files.service.includes("duplicate_client_message"), "duplicate client message conflict"],
  [files.service.includes("slow_mode"), "slow mode conflict"],
  [files.service.includes("rate_limited"), "rate limit conflict"],
  [files.service.includes("copy_text"), "copy text recovery action"],
  [files.service.includes("browserOnline"), "offline browser signal input"],
  [files.app.includes("offlineSyncConflictService.classify"), "message send failure uses conflict service"],
  [files.doc.includes("No automatic retry loop is added"), "no aggressive retry documented"],
  [files.doc.includes("The queue must not store passwords"), "secrets exclusion documented"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length > 0) {
  throw new Error(`Offline sync conflict smoke test failed: ${failed.join(", ")}`);
}

console.log("Offline sync conflict smoke test passed.");
