import fs from "node:fs";
const service=fs.readFileSync("src/services/threadService.ts","utf8");const migration=fs.readFileSync("supabase/migrations/20260710182000_threads_production.sql","utf8");const list=fs.readFileSync("src/services/messageListQuery.ts","utf8");const realtime=fs.readFileSync("src/services/supabase/realtimeService.ts","utf8");const doc=fs.readFileSync("docs/threads-placeholder.md","utf8");
for(const marker of ["open_or_create_thread","send_thread_message","getSummary","markRead","subscribe","THREAD_PAGE_LIMIT"])if(!service.includes(marker))throw new Error(`Thread service missing ${marker}`);
for(const marker of ["thread_read_states","can_reply_thread","THREAD_PARENT_INVALID","revoke insert on public.threads"])if(!migration.includes(marker))throw new Error(`Thread migration missing ${marker}`);
if(!list.includes('.is("thread_id", null)')||!realtime.includes("if (!row.thread_id)"))throw new Error("Thread replies can leak into main chat.");
for(const marker of ["100 messages","unread summary","main chat","documented limits"])if(!doc.includes(marker))throw new Error(`Thread docs missing ${marker}`);
console.log("Threads production smoke passed.");
