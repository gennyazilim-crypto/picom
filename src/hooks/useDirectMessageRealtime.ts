import { useEffect, useRef, useState } from "react";
import type { DirectMessage, DirectSharedMediaItem } from "../types/directMessages";
import { directRealtimeService, type DirectReactionRow, type DirectRealtimeEvent } from "../services/directMessages/directRealtimeService";
import { notificationService } from "../services/notificationService";
import type { RealtimeConnectionStatus } from "../services/supabase/realtimeService";

type Input = Readonly<{
  enabled: boolean;
  activeConversationId: string;
  currentUserId: string;
  isDirectMessagesViewActive: boolean;
  onInsert: (message: DirectMessage) => void;
  onUpdate: (message: DirectMessage) => void;
  onDelete: (conversationId: string, messageId: string) => void;
  onReaction: (type: "add" | "remove", reaction: DirectReactionRow) => void;
  onAttachment?: (type: "add" | "remove", attachment: DirectSharedMediaItem) => void;
  onReadState?: (conversationId: string, userId: string, lastReadAt?: string, lastReadMessageId?: string) => void;
  onConversationChanged?: (conversationId: string) => void;
  mutedConversationIds?: readonly string[];
}>;

export function useDirectMessageRealtime(input: Input): RealtimeConnectionStatus {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("idle"); const callbacksRef = useRef(input);
  useEffect(() => { callbacksRef.current = input; }, [input]);
  useEffect(() => { if (!input.enabled || !input.activeConversationId) { setStatus("idle"); return; } return directRealtimeService.subscribeActive({ conversationId: input.activeConversationId, currentUserId: input.currentUserId, onStatus: setStatus, onEvent: dispatchEvent }); }, [input.activeConversationId, input.currentUserId, input.enabled]);
  useEffect(() => { if (!input.enabled || !input.currentUserId) return; return directRealtimeService.subscribeList({ currentUserId: input.currentUserId, onStatus: (next) => { if (!callbacksRef.current.activeConversationId) setStatus(next); }, onEvent: dispatchEvent }); }, [input.currentUserId, input.enabled]);
  function dispatchEvent(event: DirectRealtimeEvent) {
    const current = callbacksRef.current;
    if (event.type === "direct_message:insert") { current.onInsert(event.message); if (event.message.authorId !== current.currentUserId && !current.mutedConversationIds?.includes(event.message.conversationId)) void notificationService.showNotification({ title: "New direct message", body: "You received a private message in Picom.", category: "direct_message", tag: `picom-dm-${event.message.conversationId}-${event.message.id}`, routing: { appFocused: typeof document !== "undefined" ? document.hasFocus() : false, activeChannelId: current.isDirectMessagesViewActive ? `dm:${current.activeConversationId}` : null, eventChannelId: `dm:${event.message.conversationId}`, isNearBottom: current.isDirectMessagesViewActive && current.activeConversationId === event.message.conversationId } }); }
    else if (event.type === "direct_message:update") current.onUpdate(event.message);
    else if (event.type === "direct_message:delete") current.onDelete(event.conversationId, event.messageId);
    else if (event.type === "direct_reaction:add" || event.type === "direct_reaction:remove") current.onReaction(event.type === "direct_reaction:add" ? "add" : "remove", event.reaction);
    else if (event.type === "direct_attachment:add" || event.type === "direct_attachment:remove") current.onAttachment?.(event.type === "direct_attachment:add" ? "add" : "remove", event.attachment);
    else if (event.type === "direct_read_state:update") current.onReadState?.(event.conversationId, event.userId, event.lastReadAt, event.lastReadMessageId);
    else if (event.type === "direct_conversation:changed") current.onConversationChanged?.(event.conversationId);
  }
  return status;
}
