import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UserStatus } from "../types/community";
import { dataSourceService } from "../services/dataSourceService";
import { loggingService } from "../services/loggingService";
import { getSupabaseClient, getSupabaseClientStatus } from "../services/supabase/supabaseClient";
import { mapRealtimeSubscriptionStatus, realtimeChannelNames, type RealtimeConnectionStatus } from "../services/supabase/realtimeService";

type PresencePayload = Readonly<{
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: UserStatus;
  lastSeen: string;
}>;

type UseSupabasePresenceChannelInput = Readonly<{
  enabled: boolean;
  communityId: string;
  currentUserId: string;
  displayName: string;
  avatarUrl?: string | null;
  status: UserStatus;
}>;

type UseSupabasePresenceChannelResult = Readonly<{
  onlineUserIds: string[];
  presenceByUserId: Record<string, PresencePayload>;
  connectionStatus: RealtimeConnectionStatus;
}>;

function isPresencePayload(value: unknown): value is PresencePayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<PresencePayload>;
  return (
    typeof payload.userId === "string" &&
    typeof payload.displayName === "string" &&
    (payload.avatarUrl === null || typeof payload.avatarUrl === "string" || typeof payload.avatarUrl === "undefined") &&
    ["online", "idle", "dnd", "offline"].includes(String(payload.status)) &&
    typeof payload.lastSeen === "string"
  );
}

function arePresenceMapsEqual(left: Record<string, PresencePayload>, right: Record<string, PresencePayload>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => {
    const leftPresence = left[key];
    const rightPresence = right[key];

    return (
      Boolean(rightPresence) &&
      leftPresence.userId === rightPresence.userId &&
      leftPresence.displayName === rightPresence.displayName &&
      leftPresence.avatarUrl === rightPresence.avatarUrl &&
      leftPresence.status === rightPresence.status &&
      leftPresence.lastSeen === rightPresence.lastSeen
    );
  });
}

export function useSupabasePresenceChannel({
  enabled,
  communityId,
  currentUserId,
  displayName,
  avatarUrl,
  status,
}: UseSupabasePresenceChannelInput): UseSupabasePresenceChannelResult {
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresencePayload>>({});
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("idle");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const safeStatus = status === "offline" ? "online" : status;

  useEffect(() => {
    setPresenceByUserId({});
    setConnectionStatus("idle");

    if (!enabled || !dataSourceService.getStatus().isSupabase) return;

    const clientStatus = getSupabaseClientStatus();
    if (!clientStatus.configured) {
      setConnectionStatus("disconnected");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setConnectionStatus("disconnected");
      return;
    }

    setConnectionStatus("connecting");
    let hasConnected = false;
    let canceled = false;
    const channel = client
      .channel(realtimeChannelNames.presence(communityId), {
        config: {
          presence: {
            key: currentUserId,
          },
        },
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const nextPresenceByUserId: Record<string, PresencePayload> = {};

        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            if (!isPresencePayload(entry)) return;

            const existing = nextPresenceByUserId[entry.userId];
            if (existing && existing.lastSeen.localeCompare(entry.lastSeen) > 0) return;

            nextPresenceByUserId[entry.userId] = {
              userId: entry.userId,
              displayName: entry.displayName.slice(0, 80),
              avatarUrl: entry.avatarUrl ?? null,
              status: entry.status === "offline" ? "online" : entry.status,
              lastSeen: entry.lastSeen,
            };
          });
        });

        setPresenceByUserId((current) => (arePresenceMapsEqual(current, nextPresenceByUserId) ? current : nextPresenceByUserId));
      })
      .subscribe(async (statusValue) => {
        if (canceled) return;

        const nextStatus = mapRealtimeSubscriptionStatus(statusValue, hasConnected);
        if (nextStatus) {
          hasConnected = nextStatus === "connected" || hasConnected;
          setConnectionStatus(nextStatus);
        }

        if (statusValue === "SUBSCRIBED") {
          await channel.track({
            userId: currentUserId,
            displayName: displayName.slice(0, 80),
            avatarUrl: avatarUrl ?? null,
            status: safeStatus,
            lastSeen: new Date().toISOString(),
          } satisfies PresencePayload);
          return;
        }

        if (statusValue === "CHANNEL_ERROR" || statusValue === "TIMED_OUT" || statusValue === "CLOSED") {
          loggingService.logWarn("Supabase presence channel status", {
            status: statusValue,
            nextStatus,
            communityId,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      canceled = true;
      channelRef.current = null;
      setConnectionStatus("disconnected");
      void channel.untrack();
      void client.removeChannel(channel);
    };
  }, [avatarUrl, communityId, currentUserId, displayName, enabled, safeStatus]);

  const onlineUserIds = useMemo(() => Object.keys(presenceByUserId), [presenceByUserId]);

  return useMemo(() => ({ onlineUserIds, presenceByUserId, connectionStatus }), [connectionStatus, onlineUserIds, presenceByUserId]);
}
