import fs from "node:fs";
const service=fs.readFileSync("src/services/announcementChannelService.ts","utf8");const header=fs.readFileSync("src/components/ChatHeader.tsx","utf8");const migration=fs.readFileSync("supabase/migrations/20260710184000_announcement_channels_production.sql","utf8");const permissions=fs.readFileSync("src/services/permissions/communityPermissions.ts","utf8");const doc=fs.readFileSync("docs/announcement-channel-placeholder.md","utf8");
for(const marker of ["isFollowing","setFollowing","canFollow"])if(!service.includes(marker))throw new Error(`Announcement service missing ${marker}`);
if(!header.includes("announcement-follow-button")||!header.includes("announcementReadOnly"))throw new Error("Announcement follow/read-only UI missing.");
for(const marker of ["sendAnnouncements","is_community_owner","announcement_channel_followers","user_id=auth.uid()","Cross-posting"])if(!migration.includes(marker))throw new Error(`Announcement RLS missing ${marker}`);
if(!permissions.includes('channel.type === "announcement"')||!permissions.includes('"sendAnnouncements"'))throw new Error("Frontend announcement permission check missing.");
for(const marker of ["read-only", "distinct styling", "No cross-posting", "RLS test checklist"])if(!doc.includes(marker))throw new Error(`Announcement docs missing ${marker}`);
console.log("Announcement channels production smoke passed.");
