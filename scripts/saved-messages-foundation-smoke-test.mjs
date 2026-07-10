import fs from "node:fs";
const service=fs.readFileSync("src/services/savedMessageService.ts","utf8");const view=fs.readFileSync("src/components/SavedMessagesView.tsx","utf8");const migration=fs.readFileSync("supabase/migrations/20260710185000_saved_messages_sync.sql","utf8");const app=fs.readFileSync("src/App.tsx","utf8");const doc=fs.readFileSync("docs/saved-messages-foundation.md","utf8");
for(const marker of ["list_accessible_saved_messages","subscribe","write(sort(items))","upsert"])if(!service.includes(marker))throw new Error(`Saved service missing ${marker}`);
if(!view.includes("visibleItems")||!view.includes("onUnsave"))throw new Error("Saved view access filtering/unsave missing.");
for(const marker of ["message.deleted_at is null","public.can_view_channel","saved.user_id=auth.uid()","supabase_realtime add table public.saved_messages"])if(!migration.includes(marker))throw new Error(`Saved RLS missing ${marker}`);
if(!app.includes("toggleMentionSaved")||!app.includes("savedMessageService.subscribe"))throw new Error("Message/feed sync integration missing.");
for(const marker of ["cross-session", "membership loss", "private channel", "manual checklist"])if(!doc.includes(marker))throw new Error(`Saved docs missing ${marker}`);
console.log("Saved messages sync smoke passed.");
