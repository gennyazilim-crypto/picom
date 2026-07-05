import fs from "node:fs";

const service = fs.readFileSync("src/services/notificationService.ts", "utf8");
const doc = fs.readFileSync("docs/advanced-notification-routing.md", "utf8");

const checks = [
  [service.includes("decideNotificationRoute"), "routing helper"],
  [service.includes("appFocused") && service.includes("isNearBottom"), "active channel context"],
  [service.includes("channelMuted") && service.includes("communityMuted"), "mute context"],
  [service.includes("mentionsOnly") && service.includes("isMention"), "mention routing"],
  [service.includes("User is already reading the active channel."), "active channel suppression"],
  [service.includes("const route = decideNotificationRoute"), "showNotification uses route"],
  [doc.includes("centralized notification routing"), "documentation"]
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error(`Advanced notification routing smoke failed: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("Advanced notification routing smoke passed.");
