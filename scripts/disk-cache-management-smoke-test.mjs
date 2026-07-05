import { readFileSync } from "node:fs";

const service = readFileSync("src/services/cacheManagementService.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");
const doc = readFileSync("docs/disk-cache-management.md", "utf8");

const checks = [
  [service.includes("getCacheSummary"), "cache summary method"],
  [service.includes("clearImageCache"), "clear image cache method"],
  [service.includes("clearMessageCache"), "clear message cache method"],
  [service.includes("clearLogs"), "clear logs method"],
  [service.includes("clearAllNonEssentialCache"), "clear all non-essential cache method"],
  [service.includes("Auth sessions are not cleared"), "auth preservation note"],
  [service.includes("Drafts are not cleared"), "draft preservation note"],
  [settings.includes("Cache management"), "Settings Advanced cache UI"],
  [settings.includes("Clear all non-essential cache"), "clear all cache action"],
  [doc.includes("must not clear auth sessions"), "docs auth safety"],
  [doc.includes("must not delete message drafts"), "docs draft safety"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);

if (failed.length) {
  throw new Error(`Disk cache management smoke test failed: ${failed.join(", ")}`);
}

console.log("Disk cache management smoke test passed.");
