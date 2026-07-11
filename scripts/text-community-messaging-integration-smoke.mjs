import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(path), "utf8");
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const includes = (source, marker, message) => expect(source.includes(marker), message);

const migration = read("supabase/migrations/20260711151000_text_community_messaging_integration.sql");
const channelService = read("src/services/channelService.ts");
const messageService = read("src/services/messageService.ts");
const mutation = read("src/services/messageSendMutation.ts");
const queue = read("src/services/messageSendQueueService.ts");
const app = read("src/App.tsx");
const realtime = read("src/hooks/useSupabaseMessageRealtime.ts");
const typing = read("src/hooks/useSupabaseTypingBroadcast.ts");
const presence = read("src/hooks/useSupabasePresenceChannel.ts");

for (const marker of ["create_managed_text_channel", "send_text_message_idempotent", "community_has_kind(target_community_id, 'text')", "effective_community_permission", "MESSAGE_IDEMPOTENCY_CONFLICT", "target_attachment_ids", "status = 'attached'", "messages_insert_author_visible_text_channel"]) includes(migration, marker, `Missing migration contract: ${marker}`);
includes(channelService, 'rpc("create_managed_text_channel"', "Channel create must use the Text-kind RPC.");
includes(mutation, 'rpc("send_text_message_idempotent"', "Message send must use the idempotent RPC.");
includes(messageService, "ensureClientMessageId", "All sends must receive a stable client message ID.");
expect(!messageService.includes("explicitAuthorId"), "Supabase mode must not accept a caller-supplied author identity.");
includes(queue, "operationsByClientMessageId", "The local queue must deduplicate in-flight retries.");
includes(app, "attachmentIds: attachments?.map", "Initial send must pass uploaded metadata IDs.");
includes(app, "attachmentIds: message.attachments?.map", "Retry must preserve uploaded metadata IDs.");
includes(realtime, "createRealtimeMessageDeduper", "Realtime inserts must reconcile optimistic messages.");
includes(realtime, "client.removeChannel(channel)", "Realtime message subscriptions must clean up.");
includes(typing, "shouldThrottleRealtimeSend", "Typing broadcasts must be throttled.");
includes(presence, "client.removeChannel(channel)", "Presence subscriptions must clean up.");

console.log("Text community Supabase messaging integration contract passed.");
