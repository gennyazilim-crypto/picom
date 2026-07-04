import { useCallback, useEffect, useRef, useState } from "react";
import { dataSourceService } from "../services/dataSourceService";
import { loggingService } from "../services/loggingService";
import { getSupabaseClient, getSupabaseClientStatus } from "../services/supabase/supabaseClient";

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
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>["channel"]> | null>(null);

  useEffect(() => {
    setTypingUsers({});

    if (!enabled || !dataSourceService.getStatus().isSupabase) return;

    const status = getSupabaseClientStatus();
    if (!status.configured) return;

    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel(`typing:${communityId}:${channelId}`, {
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
        if (statusValue === "CHANNEL_ERROR" || statusValue === "TIMED_OUT") {
          loggingService.logWarn("Supabase typing broadcast status", {
            status: statusValue,
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
      window.clearInterval(cleanupTimer);
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [channelId, communityId, currentUserId, enabled]);

  const sendTyping = useCallback((isTyping: boolean) => {
    const channel = channelRef.current;
    if (!channel) return;

    void channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId: currentUserId,
        displayName,
        isTyping,
      },
    });
  }, [currentUserId, displayName]);

  return {
    typingNames: Object.values(typingUsers).map((user) => user.displayName),
    sendTypingStart: () => sendTyping(true),
    sendTypingStop: () => sendTyping(false),
  };
}
