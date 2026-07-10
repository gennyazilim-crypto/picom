import { useEffect, useRef, useState } from "react";
import type { DirectMessage } from "../types/directMessages";
import { directRealtimeService, type DirectReactionRow, type DirectRealtimeEvent } from "../services/directMessages/directRealtimeService";
import { notificationService } from "../services/notificationService";
import type { RealtimeConnectionStatus } from "../services/supabase/realtimeService";

type Input = Readonly<{ enabled: boolean; conversationIds: readonly string[]; activeConversationId: string; currentUserId: string; isDirectMessagesViewActive: boolean; onInsert: (message: DirectMessage) => void; onUpdate: (message: DirectMessage) => void; onDelete: (conversationId: string, messageId: string) => void; onReaction: (type: "add" | "remove", reaction: DirectReactionRow) => void }>;

export function useDirectMessageRealtime(input: Input): RealtimeConnectionStatus {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("idle"); const callbacksRef = useRef(input); const conversationKey = [...input.conversationIds].sort().join("|");
  useEffect(() => { callbacksRef.current = input; }, [input]);
  useEffect(() => { if (!input.enabled) { setStatus("idle"); return; } return directRealtimeService.subscribe({ conversationIds: input.conversationIds, currentUserId: input.currentUserId, onStatus: setStatus, onEvent: dispatchEvent }); }, [conversationKey, input.currentUserId, input.enabled]);
  function dispatchEvent(event: DirectRealtimeEvent) { const current = callbacksRef.current; if (event.type === "direct_message:insert") { current.onInsert(event.message); if (event.message.authorId !== current.currentUserId) void notificationService.showNotification({ title: "New direct message", body: "You received a private message in Picom.", category: "message", tag: `picom-dm-${event.message.conversationId}`, routing: { appFocused: typeof document !== "undefined" ? document.hasFocus() : false, activeChannelId: current.isDirectMessagesViewActive ? `dm:${current.activeConversationId}` : null, eventChannelId: `dm:${event.message.conversationId}`, isNearBottom: current.isDirectMessagesViewActive && current.activeConversationId === event.message.conversationId } }); } else if (event.type === "direct_message:update") current.onUpdate(event.message); else if (event.type === "direct_message:delete") current.onDelete(event.conversationId, event.messageId); else if ("reaction" in event) current.onReaction(event.type === "direct_reaction:add" ? "add" : "remove", event.reaction); }
  return status;
}
