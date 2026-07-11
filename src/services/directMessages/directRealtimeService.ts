import type { RealtimeChannel } from "@supabase/supabase-js";
import type { DirectMessage, DirectSharedMediaItem } from "../../types/directMessages";
import { dataSourceService } from "../dataSourceService";
import type { Database } from "../supabase/database.types";
import { mapDirectMessageRow } from "../supabase/directMessageRealtimeService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { mapRealtimeSubscriptionStatus, realtimeChannelNames, type RealtimeConnectionStatus } from "../supabase/realtimeService";

type DirectMessageRow = Database["public"]["Tables"]["direct_messages"]["Row"];
export type DirectReactionRow = Database["public"]["Tables"]["direct_message_reactions"]["Row"];
export type DirectAttachmentRow = Database["public"]["Tables"]["direct_message_attachments"]["Row"];
type DirectParticipantRow = Database["public"]["Tables"]["direct_conversation_participants"]["Row"];
type DirectConversationRow = Database["public"]["Tables"]["direct_conversations"]["Row"];

export type DirectRealtimeEvent =
  | Readonly<{ type: "direct_message:insert" | "direct_message:update"; message: DirectMessage }>
  | Readonly<{ type: "direct_message:delete"; conversationId: string; messageId: string }>
  | Readonly<{ type: "direct_reaction:add" | "direct_reaction:remove"; reaction: DirectReactionRow }>
  | Readonly<{ type: "direct_attachment:add" | "direct_attachment:remove"; attachment: DirectSharedMediaItem }>
  | Readonly<{ type: "direct_read_state:update"; conversationId: string; userId: string; lastReadAt?: string; lastReadMessageId?: string }>
  | Readonly<{ type: "direct_conversation:changed"; conversationId: string }>;

type DirectRealtimeListener = (event: DirectRealtimeEvent) => void;
type ActiveSubscribeInput = Readonly<{ conversationId: string; currentUserId: string; onEvent: DirectRealtimeListener; onStatus: (status: RealtimeConnectionStatus) => void }>;
type ListSubscribeInput = Readonly<{ currentUserId: string; onEvent: DirectRealtimeListener; onStatus: (status: RealtimeConnectionStatus) => void }>;
type LegacySubscribeInput = Readonly<{ conversationIds: readonly string[]; currentUserId: string; onEvent: DirectRealtimeListener; onStatus: (status: RealtimeConnectionStatus) => void }>;
const mockActiveListeners = new Set<Readonly<{ conversationId: string; listener: DirectRealtimeListener }>>();
const mockListListeners = new Set<DirectRealtimeListener>();

function mapAttachment(row: DirectAttachmentRow): DirectSharedMediaItem { return { id: row.id, messageId: row.message_id, type: row.mime_type?.startsWith("image/") === false ? "file" : "image", url: row.url, storagePath: row.storage_path ?? undefined, name: row.file_name ?? "attachment", mimeType: row.mime_type ?? undefined, fileSize: row.size_bytes ?? row.file_size ?? undefined, width: row.width ?? undefined, height: row.height ?? undefined, createdAt: row.created_at }; }
function eventKey(event: DirectRealtimeEvent): string {
  if ("message" in event) return `${event.type}:${event.message.clientMessageId ?? event.message.id}:${event.message.editedAt ?? event.message.deletedAt ?? event.message.createdAt}`;
  if ("reaction" in event) return `${event.type}:${event.reaction.id}:${event.reaction.created_at}`;
  if ("attachment" in event) return `${event.type}:${event.attachment.id}:${event.attachment.createdAt}`;
  if (event.type === "direct_read_state:update") return `${event.type}:${event.conversationId}:${event.userId}:${event.lastReadAt ?? "none"}:${event.lastReadMessageId ?? "none"}`;
  return `${event.type}:${event.conversationId}:${"messageId" in event ? event.messageId : "summary"}`;
}
function deduplicated(listener: DirectRealtimeListener): Readonly<{ dispatch: DirectRealtimeListener; clear: () => void }> { const seen = new Map<string, number>(); return { dispatch: (event) => { if (event.type === "direct_conversation:changed") { listener(event); return; } const key = eventKey(event); if (seen.has(key)) return; seen.set(key, Date.now()); if (seen.size > 500) for (const [oldKey] of [...seen.entries()].sort((left, right) => left[1] - right[1]).slice(0, 100)) seen.delete(oldKey); listener(event); }, clear: () => seen.clear() }; }

export function subscribeToActiveDirectConversation(input: ActiveSubscribeInput): () => void {
  if (!input.conversationId) { input.onStatus("idle"); return () => undefined; }
  const guard = deduplicated(input.onEvent);
  if (dataSourceService.getStatus().isMock) { const subscription = { conversationId: input.conversationId, listener: guard.dispatch }; mockActiveListeners.add(subscription); input.onStatus("connected"); return () => { mockActiveListeners.delete(subscription); guard.clear(); }; }
  const clientStatus = getSupabaseClientStatus(); const client = getSupabaseClient();
  if (!clientStatus.configured || !client) { input.onStatus("disconnected"); return () => undefined; }
  let canceled = false; let channel: RealtimeChannel | undefined; input.onStatus("connecting");
  void (async () => {
    const [membership, messages] = await Promise.all([
      client.from("direct_conversation_participants").select("conversation_id").eq("conversation_id", input.conversationId).eq("user_id", input.currentUserId).maybeSingle(),
      client.from("direct_messages").select("id").eq("conversation_id", input.conversationId).limit(500),
    ]);
    if (canceled) return;
    if (membership.error || !membership.data || messages.error) { input.onStatus("disconnected"); return; }
    const messageIds = new Set((messages.data ?? []).map((message) => message.id)); let connected = false;
    channel = client.channel(realtimeChannelNames.directActive(input.conversationId))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${input.conversationId}` }, (payload) => { const message = mapDirectMessageRow(payload.new as DirectMessageRow); messageIds.add(message.id); guard.dispatch({ type: "direct_message:insert", message }); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${input.conversationId}` }, (payload) => guard.dispatch({ type: "direct_message:update", message: mapDirectMessageRow(payload.new as DirectMessageRow) }))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${input.conversationId}` }, (payload) => { const row = payload.old as Partial<DirectMessageRow>; if (row.id) { messageIds.delete(row.id); guard.dispatch({ type: "direct_message:delete", conversationId: input.conversationId, messageId: row.id }); } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_message_reactions" }, (payload) => { const reaction = payload.new as DirectReactionRow; if (messageIds.has(reaction.message_id)) guard.dispatch({ type: "direct_reaction:add", reaction }); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_message_reactions" }, (payload) => { const reaction = payload.old as DirectReactionRow; if (messageIds.has(reaction.message_id)) guard.dispatch({ type: "direct_reaction:remove", reaction }); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_message_attachments" }, (payload) => { const attachment = payload.new as DirectAttachmentRow; if (messageIds.has(attachment.message_id)) guard.dispatch({ type: "direct_attachment:add", attachment: mapAttachment(attachment) }); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_message_attachments" }, (payload) => { const attachment = payload.old as DirectAttachmentRow; if (messageIds.has(attachment.message_id)) guard.dispatch({ type: "direct_attachment:remove", attachment: mapAttachment(attachment) }); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_conversation_participants", filter: `conversation_id=eq.${input.conversationId}` }, (payload) => { const participant = payload.new as DirectParticipantRow; guard.dispatch({ type: "direct_read_state:update", conversationId: participant.conversation_id, userId: participant.user_id, lastReadAt: participant.last_read_at ?? undefined, lastReadMessageId: participant.last_read_message_id ?? undefined }); })
      .subscribe((value) => { const next = mapRealtimeSubscriptionStatus(value, connected); if (next === "connected") connected = true; if (next) input.onStatus(next); });
  })();
  return () => { canceled = true; guard.clear(); if (channel) void client.removeChannel(channel); };
}

export function subscribeToDirectConversationList(input: ListSubscribeInput): () => void {
  const guard = deduplicated(input.onEvent);
  if (dataSourceService.getStatus().isMock) { mockListListeners.add(guard.dispatch); input.onStatus("connected"); return () => { mockListListeners.delete(guard.dispatch); guard.clear(); }; }
  const clientStatus = getSupabaseClientStatus(); const client = getSupabaseClient();
  if (!clientStatus.configured || !client) { input.onStatus("disconnected"); return () => undefined; }
  let connected = false; input.onStatus("connecting");
  const channel = client.channel(realtimeChannelNames.directList(input.currentUserId))
    .on("postgres_changes", { event: "*", schema: "public", table: "direct_conversations" }, (payload) => { const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Partial<DirectConversationRow>; if (row.id) guard.dispatch({ type: "direct_conversation:changed", conversationId: row.id }); })
    .on("postgres_changes", { event: "*", schema: "public", table: "direct_conversation_participants", filter: `user_id=eq.${input.currentUserId}` }, (payload) => { const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Partial<DirectParticipantRow>; if (row.conversation_id) guard.dispatch({ type: "direct_conversation:changed", conversationId: row.conversation_id }); })
    .subscribe((value) => { const next = mapRealtimeSubscriptionStatus(value, connected); if (next === "connected") connected = true; if (next) input.onStatus(next); });
  return () => { guard.clear(); void client.removeChannel(channel); };
}

export function subscribeToDirectConversations(input: LegacySubscribeInput): () => void { const cleanups = input.conversationIds.map((conversationId) => subscribeToActiveDirectConversation({ ...input, conversationId })); return () => cleanups.forEach((cleanup) => cleanup()); }

export const directRealtimeService = {
  subscribe: subscribeToDirectConversations,
  subscribeActive: subscribeToActiveDirectConversation,
  subscribeList: subscribeToDirectConversationList,
  publishMock(event: DirectRealtimeEvent): void {
    for (const subscription of mockActiveListeners) { if ("message" in event && event.message.conversationId !== subscription.conversationId) continue; if (event.type === "direct_message:delete" && event.conversationId !== subscription.conversationId) continue; subscription.listener(event); }
    const conversationId = "message" in event ? event.message.conversationId : "conversationId" in event ? event.conversationId : undefined;
    if (conversationId) for (const listener of mockListListeners) listener({ type: "direct_conversation:changed", conversationId });
  },
};
