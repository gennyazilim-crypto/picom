import type { RealtimeChannel } from "@supabase/supabase-js";
import type { DirectMessage } from "../../types/directMessages";
import { dataSourceService } from "../dataSourceService";
import type { Database } from "../supabase/database.types";
import { mapDirectMessageRow } from "../supabase/directMessageRealtimeService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { mapRealtimeSubscriptionStatus, realtimeChannelNames, type RealtimeConnectionStatus } from "../supabase/realtimeService";

type DirectMessageRow = Database["public"]["Tables"]["direct_messages"]["Row"];
export type DirectReactionRow = Database["public"]["Tables"]["direct_message_reactions"]["Row"];
export type DirectRealtimeEvent =
  | Readonly<{ type: "direct_message:insert" | "direct_message:update"; message: DirectMessage }>
  | Readonly<{ type: "direct_message:delete"; conversationId: string; messageId: string }>
  | Readonly<{ type: "direct_reaction:add" | "direct_reaction:remove"; reaction: DirectReactionRow }>;

type DirectRealtimeListener = (event: DirectRealtimeEvent) => void;
const mockListeners = new Set<DirectRealtimeListener>();
type SubscribeInput = Readonly<{ conversationIds: readonly string[]; currentUserId: string; onEvent: DirectRealtimeListener; onStatus: (status: RealtimeConnectionStatus) => void }>;

function eventKey(event: DirectRealtimeEvent): string {
  if ("message" in event) { const messageKey = event.message.clientMessageId ?? event.message.id; return `${event.type}:${messageKey}:${event.message.editedAt ?? event.message.deletedAt ?? event.message.createdAt}`; }
  if ("reaction" in event) return `${event.type}:${event.reaction.id}:${event.reaction.created_at}`;
  return `${event.type}:${event.conversationId}:${event.messageId}`;
}

export function subscribeToDirectConversations(input: SubscribeInput): () => void {
  const uniqueConversationIds = [...new Set(input.conversationIds.filter(Boolean))];
  if (!uniqueConversationIds.length) { input.onStatus("idle"); return () => undefined; }
  const seen = new Map<string, number>();
  const dispatch = (event: DirectRealtimeEvent) => { const key = eventKey(event); if (seen.has(key)) return; seen.set(key, Date.now()); if (seen.size > 500) { const oldest = [...seen.entries()].sort((left, right) => left[1] - right[1]).slice(0, 100); for (const [oldKey] of oldest) seen.delete(oldKey); } input.onEvent(event); };

  if (dataSourceService.getStatus().isMock) { input.onStatus("connected"); mockListeners.add(dispatch); return () => { mockListeners.delete(dispatch); seen.clear(); }; }
  const clientStatus = getSupabaseClientStatus(); const client = getSupabaseClient();
  if (!clientStatus.configured || !client) { input.onStatus("disconnected"); return () => undefined; }
  let canceled = false; const channels: RealtimeChannel[] = []; input.onStatus("connecting");

  void (async () => {
    const { data, error } = await client.from("direct_conversation_participants").select("conversation_id").eq("user_id", input.currentUserId).in("conversation_id", uniqueConversationIds);
    if (canceled) return;
    if (error) { input.onStatus("disconnected"); return; }
    const allowedIds = [...new Set((data ?? []).map((row) => row.conversation_id))];
    if (!allowedIds.length) { input.onStatus("idle"); return; }
    for (const conversationId of allowedIds) {
      let connected = false;
      const channel = client.channel(realtimeChannelNames.directMessages(conversationId))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => dispatch({ type: "direct_message:insert", message: mapDirectMessageRow(payload.new as DirectMessageRow) }))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => dispatch({ type: "direct_message:update", message: mapDirectMessageRow(payload.new as DirectMessageRow) }))
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => { const row = payload.old as Partial<DirectMessageRow>; if (row.id) dispatch({ type: "direct_message:delete", conversationId, messageId: row.id }); })
        .subscribe((value) => { const next = mapRealtimeSubscriptionStatus(value, connected); if (next === "connected") connected = true; if (next) input.onStatus(next); });
      channels.push(channel);
    }
    const reactionChannel = client.channel(realtimeChannelNames.directReactions(input.currentUserId))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_message_reactions" }, (payload) => dispatch({ type: "direct_reaction:add", reaction: payload.new as DirectReactionRow }))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_message_reactions" }, (payload) => dispatch({ type: "direct_reaction:remove", reaction: payload.old as DirectReactionRow }))
      .subscribe();
    channels.push(reactionChannel);
  })();
  return () => { canceled = true; seen.clear(); for (const channel of channels) void client.removeChannel(channel); };
}

export const directRealtimeService = { subscribe: subscribeToDirectConversations, publishMock(event: DirectRealtimeEvent): void { for (const listener of mockListeners) listener(event); } };
