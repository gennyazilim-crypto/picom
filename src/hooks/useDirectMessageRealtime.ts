import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { DirectMessage } from "../types/directMessages";
import { dataSourceService } from "../services/dataSourceService";
import { loggingService } from "../services/loggingService";
import { notificationService } from "../services/notificationService";
import { directMessageRealtimeService, mapDirectMessageRow, type DirectMessageRealtimeEvent, type DirectReactionRow } from "../services/supabase/directMessageRealtimeService";
import type { Database } from "../services/supabase/database.types";
import { getSupabaseClient, getSupabaseClientStatus } from "../services/supabase/supabaseClient";
import { createRealtimeMessageDeduper, mapRealtimeSubscriptionStatus, type RealtimeConnectionStatus } from "../services/supabase/realtimeService";

type DirectMessageRow = Database["public"]["Tables"]["direct_messages"]["Row"];

type Input = Readonly<{
  enabled: boolean;
  conversationIds: readonly string[];
  activeConversationId: string;
  currentUserId: string;
  isDirectMessagesViewActive: boolean;
  onInsert: (message: DirectMessage) => void;
  onUpdate: (message: DirectMessage) => void;
  onDelete: (conversationId: string, messageId: string) => void;
  onReaction: (type: "add" | "remove", reaction: DirectReactionRow) => void;
}>;

export function useDirectMessageRealtime(input: Input): RealtimeConnectionStatus {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("idle");
  const callbacksRef = useRef(input);
  const deduperRef = useRef(createRealtimeMessageDeduper());
  const conversationKey = [...input.conversationIds].sort().join("|");

  useEffect(() => { callbacksRef.current = input; }, [input]);

  useEffect(() => {
    if (!input.enabled || !dataSourceService.getStatus().isMock) return;
    setStatus("connected");
    const allowed = new Set(input.conversationIds);
    return directMessageRealtimeService.subscribeMock((event) => {
      if (("message" in event && allowed.has(event.message.conversationId)) || ("conversationId" in event && allowed.has(event.conversationId)) || event.type.startsWith("direct_reaction")) {
        dispatchEvent(event);
      }
    });
  }, [conversationKey, input.enabled]);

  useEffect(() => {
    if (!input.enabled || !dataSourceService.getStatus().isSupabase || !input.conversationIds.length) {
      if (!dataSourceService.getStatus().isMock) setStatus("idle");
      return;
    }
    const clientStatus = getSupabaseClientStatus();
    const client = getSupabaseClient();
    if (!clientStatus.configured || !client) { setStatus("disconnected"); return; }

    let canceled = false;
    const channels: RealtimeChannel[] = [];
    deduperRef.current.clear();
    setStatus("connecting");

    const dispatchMessage = (event: DirectMessageRealtimeEvent) => dispatchEvent(event);
    void (async () => {
      const { data, error } = await client.from("direct_conversation_members").select("conversation_id").eq("user_id", input.currentUserId).in("conversation_id", input.conversationIds);
      if (canceled) return;
      if (error) { loggingService.logWarn("DM realtime membership verification failed", { code: error.code }, "dm-realtime"); setStatus("disconnected"); return; }
      const allowedIds = [...new Set((data ?? []).map((row) => row.conversation_id))];
      if (!allowedIds.length) { setStatus("idle"); return; }

      for (const conversationId of allowedIds) {
        let connected = false;
        const channel = client.channel(`dm:conversation:${conversationId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
            const message = mapDirectMessageRow(payload.new as DirectMessageRow);
            if (deduperRef.current.shouldProcessInsert(message)) dispatchMessage({ type: "direct_message:insert", message });
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => dispatchMessage({ type: "direct_message:update", message: mapDirectMessageRow(payload.new as DirectMessageRow) }))
          .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
            const row = payload.old as Partial<DirectMessageRow>;
            if (row.id) dispatchMessage({ type: "direct_message:delete", conversationId, messageId: row.id });
          })
          .subscribe((value) => {
            const next = mapRealtimeSubscriptionStatus(value, connected);
            if (next === "connected") connected = true;
            if (next) setStatus(next);
          });
        channels.push(channel);
      }

      const reactionChannel = client.channel(`dm:reactions:${input.currentUserId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_message_reactions" }, (payload) => dispatchMessage({ type: "direct_reaction:add", reaction: payload.new as DirectReactionRow }))
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_message_reactions" }, (payload) => dispatchMessage({ type: "direct_reaction:remove", reaction: payload.old as DirectReactionRow }))
        .subscribe();
      channels.push(reactionChannel);
    })();

    return () => { canceled = true; for (const channel of channels) void client.removeChannel(channel); };
  }, [conversationKey, input.currentUserId, input.enabled]);

  function dispatchEvent(event: DirectMessageRealtimeEvent) {
    const current = callbacksRef.current;
    if (event.type === "direct_message:insert") {
      current.onInsert(event.message);
      if (event.message.authorId !== current.currentUserId) {
        void notificationService.showNotification({
          title: "New direct message",
          body: "You received a private message in Picom.",
          category: "message",
          tag: `picom-dm-${event.message.conversationId}`,
          routing: {
            appFocused: typeof document !== "undefined" ? document.hasFocus() : false,
            activeChannelId: current.isDirectMessagesViewActive ? `dm:${current.activeConversationId}` : null,
            eventChannelId: `dm:${event.message.conversationId}`,
            isNearBottom: current.isDirectMessagesViewActive && current.activeConversationId === event.message.conversationId,
          },
        });
      }
    } else if (event.type === "direct_message:update") current.onUpdate(event.message);
    else if (event.type === "direct_message:delete") current.onDelete(event.conversationId, event.messageId);
    else if ("reaction" in event) current.onReaction(event.type === "direct_reaction:add" ? "add" : "remove", event.reaction);
  }

  return status;
}

