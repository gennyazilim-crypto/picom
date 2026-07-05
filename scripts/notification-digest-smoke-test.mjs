import { readFileSync } from "node:fs";

const settings = readFileSync("src/services/settingsService.ts", "utf8");
const service = readFileSync("src/services/notificationService.ts", "utf8");
const digest = readFileSync("src/services/notificationDigestService.ts", "utf8");
const modal = readFileSync("src/components/SettingsModal.tsx", "utf8");
const docs = readFileSync("docs/notification-digest.md", "utf8");

const checks = [
  [settings.includes("digestMode"), "digest setting"],
  [settings.includes("digestMode: \"off\""), "digest default off"],
  [digest.includes("shouldDigestNotification"), "digest decision helper"],
  [digest.includes("groupNotifications"), "digest grouping helper"],
  [digest.includes("communityId") && digest.includes("channelId") && digest.includes("date"), "group dimensions"],
  [service.includes("notificationDigestService.shouldDigestNotification"), "notification routing uses digest helper"],
  [service.includes("Notification digest placeholder grouped this normal message."), "digest route reason"],
  [modal.includes("Notification digest placeholder"), "settings UI"],
  [modal.includes("hourly_placeholder") && modal.includes("daily_placeholder"), "digest options"],
  [docs.includes("Mentions and system notifications are not digested"), "docs mention behavior"],
  [docs.includes("community, channel, and date"), "docs grouping behavior"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  throw new Error(`Notification digest smoke test failed: ${failed.join(", ")}`);
}

console.log("Notification digest smoke test passed.");
