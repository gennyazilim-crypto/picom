import fs from "node:fs";
const service=fs.readFileSync("src/services/forumService.ts","utf8");const view=fs.readFileSync("src/components/ForumChannelView.tsx","utf8");const migration=fs.readFileSync("supabase/migrations/20260710183000_forum_channels_production.sql","utf8");const doc=fs.readFileSync("docs/forum-channels.md","utf8");
for(const marker of ["listPosts","createPost","create_forum_post","MAX_RESULTS"])if(!service.includes(marker))throw new Error(`Forum service missing ${marker}`);
for(const marker of ["CreateForumPostModal","ThreadPanel","Search visible posts"])if(!view.includes(marker))throw new Error(`Forum view missing ${marker}`);
for(const marker of ["can_create_forum_post","public.can_view_channel","parent_message_id","thread_id","revoke insert on public.forum_posts"])if(!migration.includes(marker))throw new Error(`Forum migration missing ${marker}`);
for(const marker of ["RLS", "thread messages", "100 posts", "No mobile layout"])if(!doc.includes(marker))throw new Error(`Forum docs missing ${marker}`);
console.log("Forum channels production smoke passed.");
