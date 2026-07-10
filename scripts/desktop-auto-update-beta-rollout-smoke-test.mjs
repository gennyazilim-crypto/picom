import { readFile } from "node:fs/promises";

const [plan, architecture, rollout, service, packageText] = await Promise.all([
  readFile("docs/desktop-auto-update-beta-rollout.md", "utf8"),
  readFile("docs/auto-update-architecture.md", "utf8"),
  readFile("docs/safe-rollout.md", "utf8"),
  readFile("src/services/updateService.ts", "utf8"),
  readFile("package.json", "utf8"),
]);

const checks = [
  [plan.includes("Status: blocked pending explicit release and security approval"), "beta updater remains approval-gated"],
  [plan.includes("Windows Authenticode") && plan.includes("macOS Developer ID") && plan.includes("notarization") && plan.includes("Linux remains manual"), "platform signing constraints"],
  [plan.includes("Beta 1%") && plan.includes("Beta 10%") && plan.includes("Beta 50%") && plan.includes("Beta 100%"), "staged beta rings"],
  [plan.includes("signature/checksum/provenance mismatch") && plan.includes("Safe Mode") && plan.includes("Roll back only after"), "failure recovery and rollback"],
  [plan.includes("immutable HTTPS beta feed") && plan.includes("allowlisted HTTPS origin") && plan.includes("never selects a raw update URL"), "feed and renderer security boundary"],
  [service.includes("autoUpdateEnabled: false") && !service.includes("electron-updater"), "runtime remains disabled and dependency-free"],
  [architecture.includes("desktop-auto-update-beta-rollout.md") && rollout.includes("desktop-auto-update-beta-rollout.md"), "architecture and rollout references"],
  [packageText.includes('"update:beta:rollout:smoke"'), "task smoke command"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
