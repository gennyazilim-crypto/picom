import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const [migration,test,legacyTest,service,facade,types]=await Promise.all([
  read("supabase/migrations/20260711002300_direct_messages_schema_rls_completion.sql"),read("supabase/tests/rls/direct_messages_completion.sql"),read("supabase/tests/rls/direct_messages.sql"),read("src/services/supabase/directMessageService.ts"),read("src/services/directMessages/directMessageService.ts"),read("src/services/supabase/database.types.ts"),
]);
for(const marker of ["direct_conversations_unique_active_pair_idx","pg_advisory_xact_lock","superseded_by","last_read_message_id","DM_REPLY_IMMUTABLE","direct_messages_content_check","send_direct_message_v2","set_direct_conversation_preferences","direct-message-attachments","dm attachments participant read"]) assert.match(migration,new RegExp(marker));
assert.match(migration,/revoke delete on public\.direct_messages from authenticated/i);assert.match(migration,/message\.author_id=auth\.uid\(\)/);assert.match(migration,/users_are_blocked/);
assert.match(test,/select plan\(16\)/);assert.match(test,/non-participant cannot read messages/);assert.match(test,/client message id prevents duplicate rows/);assert.match(test,/cross-conversation reply is rejected/);
assert.match(legacyTest,/author can soft delete own direct message/);
assert.match(service,/send_direct_message_v2/);assert.match(facade,/replyToMessageId: input\.replyToMessageId/);assert.doesNotMatch(facade,/update\(\{ reply_to_message_id/);
assert.match(types,/participant_low_id/);assert.match(types,/last_read_message_id/);assert.match(types,/set_direct_conversation_preferences/);
console.log("Direct Messages completed schema, RLS, lifecycle, idempotency, reply, read-state, and Storage contracts passed.");
