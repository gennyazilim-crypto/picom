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
  subscribeCommunityWide?: boolean;
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

function diagnosticReference(value: string): string {
  const normalized = value.trim();
  return normalized.length <= 12 ? normalized : `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
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
    sequence: message.sequence,
  };
}

export function useSupabaseMessageRealtime({
  enabled,
  communityId,
  channelId,
  subscribeCommunityWide = false,
  onInsert,
  onUpdate,
  onDelete,
}: UseSupabaseMessageRealtimeInput): RealtimeConnectionStatus {
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("idle");
  const insertDeduperRef = useRef(createRealtimeMessageDeduper());
  const eventOrderingRef = useRef(createRealtimeEventOrderingGuard());
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const subscriptionGenerationRef = useRef(0);

  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
  }, [onDelete, onInsert, onUpdate]);

  useEffect(() => {
    if (!enabled || !dataSourceService.getStatus().isSupabase) return;

    const handleOffline = () => setConnectionStatus("disconnected");
    const handleOnline = () => {
      setConnectionStatus((current) => (current === "disconnected" ? "reconnecting" : current));
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setConnectionStatus("disconnected");
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled]);

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
    const generation = ++subscriptionGenerationRef.current;
    const scope = `${diagnosticReference(communityId)}:${subscribeCommunityWide ? "all-visible-channels" : diagnosticReference(channelId)}`;
    const insertFilter = subscribeCommunityWide ? `community_id=eq.${communityId}` : `channel_id=eq.${channelId}`;
    const diagnostics = { delivered: 0, duplicate: 0, stale: 0 };
    let hasConnected = false;
    let canceled = false;
    const isCurrentSubscription = () => !canceled && subscriptionGenerationRef.current === generation;

    const channel = client
      .channel(realtimeChannelNames.messages(communityId, subscribeCommunityWide ? "all-visible-channels" : channelId))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: insertFilter },
        (payload) => {
          if (!isCurrentSubscription()) return;
          if ((payload.new as MessageRow).thread_id) return;
          const message = mapMessageRow(payload.new as MessageRow);
          const serverTimestamp = getPayloadServerTimestamp(payload, message.createdAt);
          const orderingDecision = eventOrderingRef.current.shouldProcessEvent(
            createMessageOrderingMetadata("message:new", message, serverTimestamp),
          );

          if (!orderingDecision.shouldProcess) {
            diagnostics.stale += 1;
            loggingService.logInfo("Supabase out-of-order realtime insert ignored", {
              reason: orderingDecision.reason,
              messageRef: diagnosticReference(message.id),
              hasClientMessageId: Boolean(message.clientMessageId),
              scope,
            }, "realtime-deduplication");
            return;
          }

          if (!insertDeduperRef.current.shouldProcessInsert(message)) {
            diagnostics.duplicate += 1;
            loggingService.logInfo("Supabase duplicate realtime message ignored", {
              messageRef: diagnosticReference(message.id),
              hasClientMessageId: Boolean(message.clientMessageId),
              scope,
            }, "realtime-deduplication");
            return;
          }

          diagnostics.delivered += 1;
          onInsertRef.current(message);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          if (!isCurrentSubscription()) return;
          if ((payload.new as MessageRow).thread_id) return;
          const message = mapMessageRow(payload.new as MessageRow);
          const eventType: OrderedRealtimeEventType = message.deletedAt ? "message:delete" : "message:update";
          const serverTimestamp = getPayloadServerTimestamp(payload, getMessageOrderingTimestamp(message));
          const orderingDecision = eventOrderingRef.current.shouldProcessEvent(
            createMessageOrderingMetadata(eventType, message, serverTimestamp),
          );

          if (!orderingDecision.shouldProcess) {
            diagnostics.stale += 1;
            loggingService.logInfo("Supabase out-of-order realtime update ignored", {
              reason: orderingDecision.reason,
              messageRef: diagnosticReference(message.id),
              scope,
            }, "realtime-deduplication");
            return;
          }

          diagnostics.delivered += 1;
          onUpdateRef.current(message);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          if (!isCurrentSubscription()) return;
          const oldRow = payload.old as Partial<MessageRow>;
          if (oldRow.thread_id) return;
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
              diagnostics.stale += 1;
              loggingService.logInfo("Supabase out-of-order realtime delete ignored", {
                reason: orderingDecision.reason,
                messageRef: diagnosticReference(oldRow.id),
                scope,
              }, "realtime-deduplication");
              return;
            }

            diagnostics.delivered += 1;
            onDeleteRef.current(oldRow.id);
            return;
          }

          loggingService.logWarn("Supabase message delete event missing id", {
            scope,
          }, "realtime-deduplication");
        },
      )
      .subscribe((statusValue) => {
        if (!isCurrentSubscription()) return;

        const nextStatus = mapRealtimeSubscriptionStatus(statusValue, hasConnected);
        if (!nextStatus) return;

        if (nextStatus === "connected") {
          hasConnected = true;
          loggingService.logInfo("Supabase message realtime subscribed", { scope, generation }, "realtime-deduplication");
        }
        setConnectionStatus(nextStatus);

        if (nextStatus === "reconnecting" || nextStatus === "disconnected") {
          loggingService.logWarn("Supabase message realtime status", {
            status: statusValue,
            nextStatus,
            scope,
          }, "realtime-deduplication");
        }
      });

    return () => {
      canceled = true;
      if (subscriptionGenerationRef.current === generation) subscriptionGenerationRef.current += 1;
      loggingService.logInfo("Supabase message realtime subscription removed", {
        scope,
        generation,
        delivered: diagnostics.delivered,
        duplicate: diagnostics.duplicate,
        stale: diagnostics.stale,
      }, "realtime-deduplication");
      void client.removeChannel(channel);
    };
  }, [channelId, communityId, enabled, subscribeCommunityWide]);

  return connectionStatus;
}
