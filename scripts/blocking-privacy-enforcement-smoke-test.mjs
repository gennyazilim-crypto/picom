import { readFileSync } from "node:fs";
const app=readFileSync("src/App.tsx","utf8");
const list=readFileSync("src/components/MessageList.tsx","utf8");
const service=readFileSync("src/services/userBlockingService.ts","utf8");
const migration=readFileSync("supabase/migrations/20260710190000_blocking_privacy_enforcement.sql","utf8");
for(const marker of ["blockedUserIds.includes(item.authorId)","blockedUserIds={blockedUserIds}"]){if(!app.includes(marker))throw new Error(`Missing App block marker: ${marker}`);}
if(!list.includes("blocked-message-placeholder"))throw new Error("Blocked community messages are not collapsed.");
for(const marker of ["setBlockedUser","refreshRemoteBlocks","block_user","unblock_user"]){if(!service.includes(marker)&&!migration.includes(marker))throw new Error(`Missing block service marker: ${marker}`);}
for(const marker of ["delete from public.friendships","delete from public.friend_requests","delete from public.user_follows","blocked_users_user_rate_limit","revoke insert,delete on public.blocked_users"]){if(!migration.includes(marker))throw new Error(`Missing migration marker: ${marker}`);}
console.log("Blocking and privacy enforcement smoke test passed.");
