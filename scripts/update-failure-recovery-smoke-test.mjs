import fs from "node:fs";

const doc = fs.readFileSync("docs/update-failure-recovery.md", "utf8");
const service = fs.readFileSync("src/services/updateService.ts", "utf8");
const settings = fs.readFileSync("src/components/SettingsModal.tsx", "utf8");
const requiredDoc = [
  "Failed download",
  "Failed install",
  "Corrupted update",
  "App fails after update",
  "Rollback to previous version placeholder",
  "Safe mode after update",
  "User messaging",
  "Logs to collect",
  "When to pause rollout",
  "Hotfix procedure",
];
const missingDoc = requiredDoc.filter((item) => !doc.includes(item));
const missingSource = [
  service.includes("download_failed") ? "" : "download_failed",
  service.includes("install_failed") ? "" : "install_failed",
  service.includes("rollback_available_placeholder") ? "" : "rollback_available_placeholder",
  settings.includes("Desktop updates") ? "" : "Settings update card",
  settings.includes("Simulate download failure") ? "" : "download failure action",
  settings.includes("Rollback placeholder") ? "" : "rollback action",
].filter(Boolean);

if (missingDoc.length > 0 || missingSource.length > 0) {
  console.error(`Update failure recovery missing doc=${missingDoc.join(", ")} source=${missingSource.join(", ")}`);
  process.exit(1);
}

console.log("Update failure recovery smoke test passed.");
