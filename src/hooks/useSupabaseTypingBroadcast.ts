import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dataSourceService } from "../services/dataSourceService";
import { loggingService } from "../services/loggingService";
import { getSupabaseClient, getSupabaseClientStatus } from "../services/supabase/supabaseClient";
import {
  mapRealtimeSubscriptionStatus,
  realtimeChannelNames,
  shouldThrottleRealtimeSend,
  type RealtimeConnectionStatus,
} from "../services/supabase/realtimeService";

const TYPING_TTL_MS = 4000;

type TypingUser = Readonly<{
  userId: string;
  displayName: string;
  expiresAt: number;
}>;

type TypingPayload = Readonly<{
  userId?: unknown;
  displayName?: unknown;
  isTyping?: unknown;
  sentAt?: unknown;
}>;

type UseSupabaseTypingBroadcastInput = Readonly<{
  enabled: boolean;
  communityId: string;
  channelId: string;
  currentUserId: string;
  displayName: string;
}>;

type UseSupabaseTypingBroadcastResult = Readonly<{
  typingNames: string[];
  connectionStatus: RealtimeConnectionStatus;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
}>;

function parseTypingPayload(payload: TypingPayload): { userId: string; displayName: string; isTyping: boolean } | null {
  if (typeof payload.userId !== "string" || typeof payload.displayName !== "string" || typeof payload.isTyping !== "boolean") {
    return null;
  }

  return {
    userId: payload.userId,
    displayName: payload.displayName.slice(0, 80),
    isTyping: payload.isTyping,
  };
}

export function useSupabaseTypingBroadcast({
  enabled,
  communityId,
  channelId,
  currentUserId,
  displayName,
}: UseSupabaseTypingBroadcastInput): UseSupabaseTypingBroadcastResult {
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser>>({});
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("idle");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const lastTypingStartAtRef = useRef(0);

  useEffect(() => {
    setTypingUsers({});
    setConnectionStatus("idle");
    subscribedRef.current = false;
    lastTypingStartAtRef.current = 0;

    if (!enabled || !dataSourceService.getStatus().isSupabase) return;

    const status = getSupabaseClientStatus();
    if (!status.configured) {
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
      .channel(realtimeChannelNames.typing(communityId, channelId), {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const parsed = parseTypingPayload(payload as TypingPayload);
        if (!parsed || parsed.userId === currentUserId) return;

        setTypingUsers((current) => {
          const next = { ...current };

          if (!parsed.isTyping) {
            delete next[parsed.userId];
            return next;
          }

          next[parsed.userId] = {
            userId: parsed.userId,
            displayName: parsed.displayName,
            expiresAt: Date.now() + TYPING_TTL_MS,
          };
          return next;
        });
      })
      .subscribe((statusValue) => {
        if (canceled) return;

        const nextStatus = mapRealtimeSubscriptionStatus(statusValue, hasConnected);
        if (nextStatus) {
          hasConnected = nextStatus === "connected" || hasConnected;
          subscribedRef.current = nextStatus === "connected";
          setConnectionStatus(nextStatus);
        }

        if (statusValue === "CHANNEL_ERROR" || statusValue === "TIMED_OUT" || statusValue === "CLOSED") {
          loggingService.logWarn("Supabase typing broadcast status", {
            status: statusValue,
            nextStatus,
            communityId,
            channelId,
          });
        }
      });

    channelRef.current = channel;

    const cleanupTimer = window.setInterval(() => {
      const now = Date.now();
      setTypingUsers((current) => Object.fromEntries(Object.entries(current).filter(([, user]) => user.expiresAt > now)));
    }, 1500);

    return () => {
      canceled = true;
      window.clearInterval(cleanupTimer);
      if (subscribedRef.current) {
        void channel.send({
          type: "broadcast",
          event: "typing",
          payload: {
            userId: currentUserId,
            displayName,
            isTyping: false,
            sentAt: new Date().toISOString(),
          },
        });
      }
      channelRef.current = null;
      subscribedRef.current = false;
      lastTypingStartAtRef.current = 0;
      void client.removeChannel(channel);
    };
  }, [channelId, communityId, currentUserId, displayName, enabled]);

  const sendTyping = useCallback((isTyping: boolean) => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;

    const now = Date.now();
    if (isTyping && shouldThrottleRealtimeSend(lastTypingStartAtRef.current, now)) return;
    lastTypingStartAtRef.current = isTyping ? now : 0;

    void channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: currentUserId,
        displayName,
        isTyping,
        sentAt: new Date().toISOString(),
      },
    });
  }, [currentUserId, displayName]);

  const typingNames = useMemo(
    () => Object.values(typingUsers).map((user) => user.displayName).sort((left, right) => left.localeCompare(right)),
    [typingUsers],
  );

  return {
    typingNames,
    connectionStatus,
    sendTypingStart: () => sendTyping(true),
    sendTypingStop: () => sendTyping(false),
  };
}
