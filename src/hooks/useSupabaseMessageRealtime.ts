import { useEffect, useRef, useState } from "react";
import { dataSourceService } from "../services/dataSourceService";
import { loggingService } from "../services/loggingService";
import { mapMessageRow, type MessageRow, type MessageSummary } from "../services/messageService";
import { getSupabaseClient, getSupabaseClientStatus } from "../services/supabase/supabaseClient";
import {
  createRealtimeEventId,
  createRealtimeEventOrderingGuard,
  createRealtimeMessageDeduper,
  mapRealtimeSubscriptionStatus,
  realtimeChannelNames,
  type OrderedRealtimeEventType,
  type RealtimeConnectionStatus,
  type RealtimeEventOrderingMetadata,
} from "../services/supabase/realtimeService";

type UseSupabaseMessageRealtimeInput = Readonly<{
  enabled: boolean;
  communityId: string;
  channelId: string;
  onInsert: (message: MessageSummary) => void;
  onUpdate: (message: MessageSummary) => void;
  onDelete: (messageId: string) => void;
}>;

export type { RealtimeConnectionStatus } from "../services/supabase/realtimeService";

type RealtimePayloadTimestamp = Readonly<{
  commit_timestamp?: string | null;
}>;

function getPayloadServerTimestamp(payload: RealtimePayloadTimestamp, fallback?: string | null): string {
  return payload.commit_timestamp ?? fallback ?? new Date().toISOString();
}

function getMessageOrderingTimestamp(message: MessageSummary): string {
  return message.deletedAt ?? message.editedAt ?? message.createdAt;
}

function createMessageOrderingMetadata(
  type: OrderedRealtimeEventType,
  message: MessageSummary,
  serverTimestamp: string,
): RealtimeEventOrderingMetadata {
  return {
    eventId: createRealtimeEventId({
      type,
      communityId: message.communityId,
      channelId: message.channelId,
      messageId: message.id,
      serverTimestamp,
      clientMessageId: message.clientMessageId,
    }),
    type,
    communityId: message.communityId,
    channelId: message.channelId,
    messageId: message.id,
    serverTimestamp,
    sequence: null,
  };
}

export function useSupabaseMessageRealtime({
  enabled,
  communityId,
  channelId,
  onInsert,
  onUpdate,
  onDelete,
}: UseSupabaseMessageRealtimeInput): RealtimeConnectionStatus {
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("idle");
  const insertDeduperRef = useRef(createRealtimeMessageDeduper());
  const eventOrderingRef = useRef(createRealtimeEventOrderingGuard());

  useEffect(() => {
    if (!enabled || !dataSourceService.getStatus().isSupabase) {
      setConnectionStatus("idle");
      return;
    }

    const status = getSupabaseClientStatus();
    if (!status.configured) {
      setConnectionStatus("disconnected");
      loggingService.logWarn("Supabase message realtime skipped", { reason: status.reason });
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setConnectionStatus("disconnected");
      loggingService.logWarn("Supabase message realtime skipped", { reason: "client_unavailable" });
      return;
    }

    setConnectionStatus("connecting");
    insertDeduperRef.current.clear();
    eventOrderingRef.current.clear();
    let hasConnected = false;
    let canceled = false;

    const channel = client
      .channel(realtimeChannelNames.messages(communityId, channelId))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const message = mapMessageRow(payload.new as MessageRow);
          const serverTimestamp = getPayloadServerTimestamp(payload, message.createdAt);
          const orderingDecision = eventOrderingRef.current.shouldProcessEvent(
            createMessageOrderingMetadata("message:new", message, serverTimestamp),
          );

          if (!orderingDecision.shouldProcess) {
            loggingService.logInfo("Supabase out-of-order realtime insert ignored", {
              reason: orderingDecision.reason,
              messageId: message.id,
              clientMessageId: message.clientMessageId,
              communityId,
              channelId,
            });
            return;
          }

          if (!insertDeduperRef.current.shouldProcessInsert(message)) {
            loggingService.logInfo("Supabase duplicate realtime message ignored", {
              messageId: message.id,
              clientMessageId: message.clientMessageId,
              communityId,
              channelId,
            });
            return;
          }

          onInsert(message);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const message = mapMessageRow(payload.new as MessageRow);
          const eventType: OrderedRealtimeEventType = message.deletedAt ? "message:delete" : "message:update";
          const serverTimestamp = getPayloadServerTimestamp(payload, getMessageOrderingTimestamp(message));
          const orderingDecision = eventOrderingRef.current.shouldProcessEvent(
            createMessageOrderingMetadata(eventType, message, serverTimestamp),
          );

          if (!orderingDecision.shouldProcess) {
            loggingService.logInfo("Supabase out-of-order realtime update ignored", {
              reason: orderingDecision.reason,
              messageId: message.id,
              communityId,
              channelId,
            });
            return;
          }

          onUpdate(message);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const oldRow = payload.old as Partial<MessageRow>;
          if (oldRow.id) {
            const serverTimestamp = getPayloadServerTimestamp(payload, new Date().toISOString());
            const orderingDecision = eventOrderingRef.current.shouldProcessEvent({
              eventId: createRealtimeEventId({
                type: "message:delete",
                communityId,
                channelId,
                messageId: oldRow.id,
                serverTimestamp,
              }),
              type: "message:delete",
              communityId,
              channelId,
              messageId: oldRow.id,
              serverTimestamp,
              sequence: null,
            });

            if (!orderingDecision.shouldProcess) {
              loggingService.logInfo("Supabase out-of-order realtime delete ignored", {
                reason: orderingDecision.reason,
                messageId: oldRow.id,
                communityId,
                channelId,
              });
              return;
            }

            onDelete(oldRow.id);
            return;
          }

          loggingService.logWarn("Supabase message delete event missing id", {
            communityId,
            channelId,
          });
        },
      )
      .subscribe((statusValue) => {
        if (canceled) return;

        const nextStatus = mapRealtimeSubscriptionStatus(statusValue, hasConnected);
        if (!nextStatus) return;

        if (nextStatus === "connected") hasConnected = true;
        setConnectionStatus(nextStatus);

        if (nextStatus === "reconnecting" || nextStatus === "disconnected") {
          loggingService.logWarn("Supabase message realtime status", {
            status: statusValue,
            nextStatus,
            communityId,
            channelId,
          });
        }
      });

    return () => {
      canceled = true;
      void client.removeChannel(channel);
    };
  }, [channelId, communityId, enabled, onDelete, onInsert, onUpdate]);

  return connectionStatus;
}
