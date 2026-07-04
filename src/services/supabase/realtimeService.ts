export type RealtimeConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "reconnecting";

export const REALTIME_TYPING_THROTTLE_MS = 1200;

export const realtimeChannelNames = {
  messages: (communityId: string, channelId: string) => `room:community:${communityId}:channel:${channelId}`,
  presence: (communityId: string) => `presence:community:${communityId}`,
  typing: (communityId: string, channelId: string) => `typing:community:${communityId}:channel:${channelId}`,
} as const;

export function mapRealtimeSubscriptionStatus(status: string, hasConnected: boolean): RealtimeConnectionStatus | null {
  if (status === "SUBSCRIBED") return "connected";
  if (status === "CLOSED") return hasConnected ? "disconnected" : "disconnected";
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") return hasConnected ? "reconnecting" : "disconnected";
  return null;
}

function rememberBoundedValue(values: string[], seen: Set<string>, value: string, maxEntries: number) {
  if (seen.has(value)) return;

  seen.add(value);
  values.push(value);

  while (values.length > maxEntries) {
    const oldest = values.shift();
    if (oldest) seen.delete(oldest);
  }
}

export function createRealtimeMessageDeduper(maxEntries = 500) {
  const messageIds: string[] = [];
  const clientMessageIds: string[] = [];
  const seenMessageIds = new Set<string>();
  const seenClientMessageIds = new Set<string>();

  return {
    clear() {
      messageIds.length = 0;
      clientMessageIds.length = 0;
      seenMessageIds.clear();
      seenClientMessageIds.clear();
    },
    shouldProcessInsert(message: { id: string; clientMessageId?: string | null }) {
      if (seenMessageIds.has(message.id)) return false;
      if (message.clientMessageId && seenClientMessageIds.has(message.clientMessageId)) return false;

      rememberBoundedValue(messageIds, seenMessageIds, message.id, maxEntries);

      if (message.clientMessageId) {
        rememberBoundedValue(clientMessageIds, seenClientMessageIds, message.clientMessageId, maxEntries);
      }

      return true;
    },
  };
}

export function shouldThrottleRealtimeSend(lastSentAt: number, now = Date.now(), throttleMs = REALTIME_TYPING_THROTTLE_MS) {
  return lastSentAt > 0 && now - lastSentAt < throttleMs;
}
