import { readFileSync } from "node:fs";

const service = readFileSync("src/services/userSafetyCenterService.ts", "utf8");
const blocking = readFileSync("src/services/userBlockingService.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");
const docs = readFileSync("docs/user-safety-center.md", "utf8");

const checks = [
  [service.includes("whoCanDmMe"), "DM policy setting"],
  [service.includes("whoCanSendFriendRequests"), "friend request policy setting"],
  [service.includes("showOnlineStatus"), "online status setting"],
  [service.includes("enableReadReceipts"), "read receipt setting"],
  [settings.includes("Privacy & Safety"), "settings section"],
  [settings.includes("userBlockingService.listBlockedUsers"), "blocked users integration"],
  [settings.includes("dataExportService.refreshStatus") && settings.includes("requestDataExport"), "data export action"],
  [settings.includes("accountDeletionService.refreshStatus") && settings.includes("Request account deletion"), "account deletion status action"],
  [settings.includes("Report a problem"), "report problem action"],
  [blocking.includes("listBlockedUsers"), "blocking service list API"],
  [docs.includes("No passwords, tokens, cookies"), "sensitive data boundary"],
  [docs.includes("Future Supabase requirements"), "backend enforcement TODO"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  throw new Error(`User safety center smoke test failed: ${failed.join(", ")}`);
}

console.log("User safety center smoke test passed.");
