import { readFileSync } from "node:fs";

const settings = readFileSync("src/services/settingsService.ts", "utf8");
const service = readFileSync("src/services/notificationService.ts", "utf8");
const modal = readFileSync("src/components/SettingsModal.tsx", "utf8");
const docs = readFileSync("docs/quiet-hours.md", "utf8");

const checks = [
  [settings.includes("QuietHoursSettings"), "quiet hours settings type"],
  [settings.includes("startTime: \"22:00\""), "default start time"],
  [settings.includes("endTime: \"07:00\""), "default end time"],
  [service.includes("isQuietHoursActive"), "quiet hours active helper"],
  [service.includes("quietHoursSuppressesDesktop"), "desktop suppression helper"],
  [service.includes("Quiet Hours suppressed this desktop notification."), "suppression reason"],
  [service.includes("quietHoursShouldSilence"), "sounds-only silence helper"],
  [modal.includes("Enable Quiet Hours"), "settings toggle"],
  [modal.includes("type=\"time\""), "time inputs"],
  [modal.includes("Allow mentions during Quiet Hours"), "mentions override UI"],
  [docs.includes("Overnight schedules are supported"), "docs overnight support"],
  [docs.includes("system timezone"), "docs local timezone"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  throw new Error(`Quiet Hours smoke test failed: ${failed.join(", ")}`);
}

console.log("Quiet Hours smoke test passed.");
