import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260710205000_reply_system_production.sql", "utf8");
const service = readFileSync("src/services/messageService.ts", "utf8");
const mutation = readFileSync("src/services/messageSendMutation.ts", "utf8");
const listQuery = readFileSync("src/services/messageListQuery.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const messageItem = readFileSync("src/components/MessageItem.tsx", "utf8");
const databaseTypes = readFileSync("src/services/supabase/database.types.ts", "utf8");
const rlsTest = readFileSync("supabase/tests/rls/reply_system_production.sql", "utf8");

for (const marker of [
  "reply_to_message_id uuid references public.messages(id) on delete set null",
  "REPLY_TARGET_IMMUTABLE",
  "REPLY_TARGET_DELETED",
  "REPLY_TARGET_CHANNEL_MISMATCH",
  "before insert or update of reply_to_message_id, channel_id, community_id",
  "revoke all on function public.validate_message_reply_target()",
]) assert.ok(migration.includes(marker), `missing reply migration marker: ${marker}`);

for (const [name, source] of [["service", service], ["mutation", mutation], ["list query", listQuery], ["database types", databaseTypes]]) {
  assert.ok(source.includes("reply_to_message_id"), `${name} must preserve persisted reply IDs`);
}
assert.ok(service.includes("replyToMessageId?: string | null"), "send input must accept reply target");
assert.ok(mutation.includes("reply_to_message_id: input.replyToMessageId ?? null"), "send mutation must persist reply target");
assert.ok(app.includes("replyToMessageId: message.replyToMessageId"), "offline retry must preserve reply target");
assert.ok(app.includes("replyToMessageId: result.data.replyToMessageId"), "confirmation must reconcile server reply target");
assert.ok(messageItem.includes("Original message unavailable."), "unavailable/deleted reply fallback must remain rendered");

for (const marker of ["same-channel reply persists", "cross-channel reply is rejected", "soft-deleted target retains fallback reference", "visitor cannot read private reply or target metadata"]) {
  assert.ok(rlsTest.includes(marker), `missing reply pgTAP coverage: ${marker}`);
}

console.log("Reply system production static smoke: PASS");
