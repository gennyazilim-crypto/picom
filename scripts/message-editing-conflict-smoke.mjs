import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("supabase/migrations/20260710208000_message_editing_conflict_handling.sql","utf8");
const edit=readFileSync("src/services/messageEditMutation.ts","utf8");
const remove=readFileSync("src/services/messageDeleteMutation.ts","utf8");
const service=readFileSync("src/services/messageService.ts","utf8");
const app=readFileSync("src/App.tsx","utf8");
const state=readFileSync("src/state/useLocalMessageState.ts","utf8");
const realtime=readFileSync("src/services/supabase/realtimeService.ts","utf8");
const item=readFileSync("src/components/MessageItem.tsx","utf8");

for(const marker of ["edit_message_with_version","delete_message_with_version","MESSAGE_VERSION_CONFLICT","MESSAGE_DELETED_CONFLICT","for update","revoke update on public.messages","role.level>=60"]) assert.ok(migration.includes(marker),`missing CAS marker: ${marker}`);
assert.ok(edit.includes('rpc("edit_message_with_version"'),"edit mutation must use CAS RPC");
assert.ok(remove.includes('rpc("delete_message_with_version"'),"delete mutation must use CAS RPC");
assert.ok(service.includes("MESSAGE_EDIT_CONFLICT")&&service.includes("MESSAGE_DELETE_CONFLICT"),"service must expose conflict codes");
assert.ok(app.includes("previousEditedAt")&&app.includes("previousBody"),"optimistic edit must retain rollback snapshot");
assert.ok(app.includes("messageService.deleteMessage"),"delete UI must use production service");
assert.ok(state.includes("existing.deletedAt && !incoming.deletedAt"),"local tombstone must win");
assert.ok(realtime.includes('event.type !== "message:delete" && deletedTimestamp !== undefined'),"realtime tombstone must be terminal");
assert.ok(item.includes("wasEditingRef"),"failed edit draft must remain recoverable");
console.log("Message editing conflict handling smoke: PASS");
