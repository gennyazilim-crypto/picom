import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UserStatus } from "../types/community";
import { dataSourceService } from "../services/dataSourceService";
import { loggingService } from "../services/loggingService";
import { getSupabaseClient, getSupabaseClientStatus } from "../services/supabase/supabaseClient";

type PresencePayload = Readonly<{
  userId: string;
  displayName: string;
  status: UserStatus;
  onlineAt: string;
}>;

type UseSupabasePresenceChannelInput = Readonly<{
  enabled: boolean;
  communityId: string;
  currentUserId: string;
  displayName: string;
  status: UserStatus;
}>;

type UseSupabasePresenceChannelResult = Readonly<{
  onlineUserIds: string[];
}>;

function isPresencePayload(value: unknown): value is PresencePayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<PresencePayload>;
  return typeof payload.userId === "string" && typeof payload.displayName === "string";
}

export function useSupabasePresenceChannel({
  enabled,
  communityId,
  currentUserId,
  displayName,
  status,
}: UseSupabasePresenceChannelInput): UseSupabasePresenceChannelResult {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const safeStatus = status === "offline" ? "online" : status;

  useEffect(() => {
    setOnlineUserIds([]);

    if (!enabled || !dataSourceService.getStatus().isSupabase) return;

    const clientStatus = getSupabaseClientStatus();
    if (!clientStatus.configured) return;

    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel(`presence:community:${communityId}`, {
        config: {
          presence: {
            key: currentUserId,
          },
        },
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();

        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            if (isPresencePayload(entry)) ids.add(entry.userId);
          });
        });

        setOnlineUserIds([...ids]);
      })
      .subscribe(async (statusValue) => {
        if (statusValue === "SUBSCRIBED") {
          await channel.track({
            userId: currentUserId,
            displayName: displayName.slice(0, 80),
            status: safeStatus,
            onlineAt: new Date().toISOString(),
          } satisfies PresencePayload);
          return;
        }

        if (statusValue === "CHANNEL_ERROR" || statusValue === "TIMED_OUT") {
          loggingService.logWarn("Supabase presence channel status", {
            status: statusValue,
            communityId,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void channel.untrack();
      void client.removeChannel(channel);
    };
  }, [communityId, currentUserId, displayName, enabled, safeStatus]);

  return useMemo(() => ({ onlineUserIds }), [onlineUserIds]);
}
