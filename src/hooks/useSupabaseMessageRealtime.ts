import { useEffect } from "react";
import { dataSourceService } from "../services/dataSourceService";
import { loggingService } from "../services/loggingService";
import { mapMessageRow, type MessageRow, type MessageSummary } from "../services/messageService";
import { getSupabaseClient, getSupabaseClientStatus } from "../services/supabase/supabaseClient";

type UseSupabaseMessageRealtimeInput = Readonly<{
  enabled: boolean;
  communityId: string;
  channelId: string;
  onInsert: (message: MessageSummary) => void;
  onUpdate: (message: MessageSummary) => void;
  onDelete: (messageId: string) => void;
}>;

export function useSupabaseMessageRealtime({
  enabled,
  communityId,
  channelId,
  onInsert,
  onUpdate,
  onDelete,
}: UseSupabaseMessageRealtimeInput): void {
  useEffect(() => {
    if (!enabled || !dataSourceService.getStatus().isSupabase) return;

    const status = getSupabaseClientStatus();
    if (!status.configured) {
      loggingService.logWarn("Supabase message realtime skipped", { reason: status.reason });
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      loggingService.logWarn("Supabase message realtime skipped", { reason: "client_unavailable" });
      return;
    }

    const channel = client
      .channel(`messages:${communityId}:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        (payload) => onInsert(mapMessageRow(payload.new as MessageRow)),
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
          if (oldRow.id) onDelete(oldRow.id);
        },
      )
      .subscribe((statusValue) => {
        if (statusValue === "CHANNEL_ERROR" || statusValue === "TIMED_OUT") {
          loggingService.logWarn("Supabase message realtime status", {
            status: statusValue,
            communityId,
            channelId,
          });
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [channelId, communityId, enabled, onDelete, onInsert, onUpdate]);
}
