import fs from "node:fs";

const service = fs.readFileSync("src/services/customEmojiService.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260710178000_custom_emoji_moderation_storage.sql", "utf8");
const admin = fs.readFileSync("src/components/CommunityEmojisAdminSection.tsx", "utf8");
const doc = fs.readFileSync("docs/custom-emoji-foundation.md", "utf8");

for (const marker of ["validateContent", "MAX_EMOJI_BYTES", "storagePath", "setEnabled", "Emoji names must be unique", "createSignedUrl"]) {
  if (!service.includes(marker)) throw new Error(`Custom emoji service missing ${marker}`);
}
for (const marker of ["community-emojis", "524288", "moderation_status", "can_manage_channel_webhooks", "storage.objects", "public = false"]) {
  if (!migration.includes(marker)) throw new Error(`Custom emoji migration missing ${marker}`);
}
if (!admin.includes("Disable") || !admin.includes("canManage")) throw new Error("Custom emoji moderation UI is incomplete.");
for (const marker of ["private bucket", "unique per community", "No copyrighted", "disabled"]) {
  if (!doc.includes(marker)) throw new Error(`Custom emoji documentation missing ${marker}`);
}

console.log("Custom emoji moderation and storage smoke passed.");
