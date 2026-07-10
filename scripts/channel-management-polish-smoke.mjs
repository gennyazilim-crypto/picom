import fs from "node:fs";
const checks = [
  ["src/components/ChannelManagementModals.tsx", ["EditChannelModal", "DeleteChannelModal", "Type"]],
  ["src/services/channelService.ts", ["update_managed_channel", "delete_managed_channel", "LAST_CHANNEL_REQUIRED"]],
  ["src/App.tsx", ["canManageChannels", "setEditingChannel", "fallbackChannelId"]],
  ["supabase/migrations/20260710215000_channel_management_polish.sql", ["security definer", "PERMISSION_DENIED", "LAST_CHANNEL_REQUIRED"]],
];
for (const [file, needles] of checks) {
  const source = fs.readFileSync(file, "utf8");
  for (const needle of needles) if (!source.includes(needle)) throw new Error(`${file} is missing ${needle}`);
}
console.log("Channel management polish smoke passed.");
