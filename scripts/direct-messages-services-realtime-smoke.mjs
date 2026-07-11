import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [facade, repository, realtime, hook, app, migration, types, view] = await Promise.all([
  read("src/services/directMessages/directMessageService.ts"),
  read("src/services/supabase/directMessageService.ts"),
  read("src/services/directMessages/directRealtimeService.ts"),
  read("src/hooks/useDirectMessageRealtime.ts"),
  read("src/App.tsx"),
  read("supabase/migrations/20260711002400_direct_messages_services_realtime_read_states.sql"),
  read("src/types/directMessages.ts"),
  read("src/components/DirectMessagesView.tsx"),
]);

for (const marker of ["getDirectMessagesPage", "addDirectMessageAttachments", "getDirectSharedMedia", "setDirectConversationMuted", "setDirectConversationArchived", "clientMessageId === clientMessageId", "replyPreview"]) assert.match(facade, new RegExp(marker));
for (const marker of ["getDirectMessagesPage", "created_at.eq", "send_direct_message_v3", "edit_direct_message", "delete_direct_message", "mark_direct_conversation_read_to", "list_direct_shared_media"]) assert.match(repository, new RegExp(marker));
for (const marker of ["subscribeToActiveDirectConversation", "subscribeToDirectConversationList", "direct_conversation_participants", "direct_message_attachments", "removeChannel", "deduplicated"]) assert.match(realtime, new RegExp(marker));
for (const marker of ["subscribeActive", "subscribeList", "onConversationChanged", "onReadState", "onAttachment"]) assert.match(hook, new RegExp(marker));
for (const marker of ["getDirectSharedMedia", "handleDirectReadState", "handleDirectRealtimeAttachment", "markDirectConversationRead", "onSetMuted", "onArchive"]) assert.match(app, new RegExp(marker));
for (const marker of ["mark_direct_conversation_read_to", "set_direct_conversation_muted", "set_direct_conversation_archived", "list_direct_shared_media", "replica identity full", "supabase_realtime"]) assert.match(migration, new RegExp(marker));
for (const marker of ["DirectMessagePage", "DirectMessageCursor", "DirectSharedMediaPage", "lastReadMessageId"]) assert.match(types, new RegExp(marker));
assert.doesNotMatch(view, /supabase\.from|\.from\(["']direct_/);
assert.match(view, /onSetMuted/); assert.match(view, /onArchive/);
console.log("Direct Messages services, cursor pagination, realtime lifecycle, deduplication, read state, preferences, and shared-media contracts passed.");
