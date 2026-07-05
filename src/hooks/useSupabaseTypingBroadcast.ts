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

function parseTypingTimestamp(value: unknown): number {
  if (typeof value !== "string") return Date.now();

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function parseTypingPayload(payload: TypingPayload): { userId: string; displayName: string; isTyping: boolean; sentAt: number } | null {
  if (typeof payload.userId !== "string" || typeof payload.displayName !== "string" || typeof payload.isTyping !== "boolean") {
    return null;
  }

  return {
    userId: payload.userId,
    displayName: payload.displayName.slice(0, 80),
    isTyping: payload.isTyping,
    sentAt: parseTypingTimestamp(payload.sentAt),
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
  const latestTypingEventAtRef = useRef<Record<string, number>>({});

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
    setTypingUsers({});
    setConnectionStatus("idle");
    subscribedRef.current = false;
    lastTypingStartAtRef.current = 0;
    latestTypingEventAtRef.current = {};

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
          const latestEventAt = latestTypingEventAtRef.current[parsed.userId] ?? 0;
          if (parsed.sentAt < latestEventAt) return current;

          latestTypingEventAtRef.current[parsed.userId] = parsed.sentAt;
          const next = { ...current };

          if (!parsed.isTyping) {
            if (!next[parsed.userId]) return current;
            delete next[parsed.userId];
            return next;
          }

          const expiresAt = Date.now() + TYPING_TTL_MS;
          const currentUser = next[parsed.userId];
          if (currentUser?.displayName === parsed.displayName && currentUser.expiresAt > Date.now()) {
            next[parsed.userId] = { ...currentUser, expiresAt };
            return next;
          }

          next[parsed.userId] = {
            userId: parsed.userId,
            displayName: parsed.displayName,
            expiresAt,
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
      latestTypingEventAtRef.current = {};
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
