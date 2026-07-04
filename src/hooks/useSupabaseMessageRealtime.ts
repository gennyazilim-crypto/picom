import { useEffect, useRef, useState } from "react";
import { dataSourceService } from "../services/dataSourceService";
import { loggingService } from "../services/loggingService";
import { mapMessageRow, type MessageRow, type MessageSummary } from "../services/messageService";
import { getSupabaseClient, getSupabaseClientStatus } from "../services/supabase/supabaseClient";
import {
  createRealtimeMessageDeduper,
  mapRealtimeSubscriptionStatus,
  realtimeChannelNames,
  type RealtimeConnectionStatus,
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
    let hasConnected = false;
    let canceled = false;

    const channel = client
      .channel(realtimeChannelNames.messages(communityId, channelId))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const message = mapMessageRow(payload.new as MessageRow);

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
        (payload) => onUpdate(mapMessageRow(payload.new as MessageRow)),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const oldRow = payload.old as Partial<MessageRow>;
          if (oldRow.id) {
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
