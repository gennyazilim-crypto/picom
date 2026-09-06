import fs from "node:fs";
const checks = [
  ["src/components/ChannelManagementModals.tsx", ["EditChannelModal", "Type"]],
  ["src/components/CommunityStructureManagementPanel.tsx", ["access.isOwner", "Bu işlem geri alınamaz.", "Kanalı sil"]],
  ["src/services/channelService.ts", ["update_managed_channel", "delete_managed_channel", "LAST_CHANNEL_REQUIRED"]],
  ["src/App.tsx", ["communityAccess.isOwner", "handleDeleteChannel", "fallbackChannelId"]],
  ["supabase/migrations/20260906230000_immediate_community_deletion.sql", ["security definer", "community.owner_id = auth.uid()", "LAST_CHANNEL_REQUIRED"]],
];
for (const [file, needles] of checks) {
  const source = fs.readFileSync(file, "utf8");
  for (const needle of needles) if (!source.includes(needle)) throw new Error(`${file} is missing ${needle}`);
}
console.log("Channel management polish smoke passed.");
