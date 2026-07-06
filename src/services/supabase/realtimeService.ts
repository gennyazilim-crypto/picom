import { getSupabaseClient } from "./supabaseClient";
import { mapMessageRow, type MessageRow, type MessageSummary } from "../messageService";

export type RealtimeConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "reconnecting";

export const REALTIME_TYPING_THROTTLE_MS = 1200;
export const REALTIME_PRESENCE_TRACK_THROTTLE_MS = 2000;

export type OrderedRealtimeEventType =
  | "message:new"
  | "message:update"
  | "message:delete"
  | "message:reaction:add"
  | "message:reaction:remove";

export type RealtimeEventOrderingMetadata = Readonly<{
  eventId: string;
  type: OrderedRealtimeEventType;
  communityId: string;
  channelId: string;
  messageId: string;
  serverTimestamp: string;
  sequence?: number | null;
}>;

export type RealtimeEventOrderingDecision = Readonly<{
  shouldProcess: boolean;
  reason?: "duplicate_event" | "older_than_current" | "older_than_delete";
}>;

export const realtimeChannelNames = {
  messages: (communityId: string, channelId: string) => `room:community:${communityId}:channel:${channelId}`,
  presence: (communityId: string) => `presence:community:${communityId}`,
  typing: (communityId: string, channelId: string) => `typing:community:${communityId}:channel:${channelId}`,
} as const;

export function mapRealtimeSubscriptionStatus(status: string, hasConnected: boolean): RealtimeConnectionStatus | null {
  if (status === "SUBSCRIBED") return "connected";
  if (status === "CLOSED") return hasConnected ? "reconnecting" : "disconnected";
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

function getOrderingKey(event: RealtimeEventOrderingMetadata): string {
  return `${event.communityId}:${event.channelId}:${event.messageId}`;
}

function parseOrderingTimestamp(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldTreatAsOlder(candidateTimestamp: number, currentTimestamp: number | undefined): boolean {
  if (!currentTimestamp || candidateTimestamp <= 0) return false;
  return candidateTimestamp < currentTimestamp;
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

export function createRealtimeEventId(input: {
  type: OrderedRealtimeEventType;
  communityId: string;
  channelId: string;
  messageId: string;
  serverTimestamp: string;
  clientMessageId?: string | null;
  sequence?: number | null;
}) {
  const sequencePart = input.sequence == null ? "no-sequence" : `seq-${input.sequence}`;
  const clientPart = input.clientMessageId ? `client-${input.clientMessageId}` : "no-client";
  return [
    input.type,
    input.communityId,
    input.channelId,
    input.messageId,
    input.serverTimestamp || "unknown-timestamp",
    sequencePart,
    clientPart,
  ].join(":");
}

export function createRealtimeEventOrderingGuard(maxEntries = 1000) {
  const eventIds: string[] = [];
  const seenEventIds = new Set<string>();
  const latestMessageTimestamps = new Map<string, number>();
  const deletedMessageTimestamps = new Map<string, number>();

  return {
    clear() {
      eventIds.length = 0;
      seenEventIds.clear();
      latestMessageTimestamps.clear();
      deletedMessageTimestamps.clear();
    },
    shouldProcessEvent(event: RealtimeEventOrderingMetadata): RealtimeEventOrderingDecision {
      if (seenEventIds.has(event.eventId)) {
        return { shouldProcess: false, reason: "duplicate_event" };
      }

      rememberBoundedValue(eventIds, seenEventIds, event.eventId, maxEntries);

      const key = getOrderingKey(event);
      const eventTimestamp = parseOrderingTimestamp(event.serverTimestamp);
      const latestTimestamp = latestMessageTimestamps.get(key);
      const deletedTimestamp = deletedMessageTimestamps.get(key);

      if (event.type !== "message:delete" && shouldTreatAsOlder(eventTimestamp, deletedTimestamp)) {
        return { shouldProcess: false, reason: "older_than_delete" };
      }

      if (shouldTreatAsOlder(eventTimestamp, latestTimestamp)) {
        return { shouldProcess: false, reason: "older_than_current" };
      }

      if (event.type === "message:delete") {
        deletedMessageTimestamps.set(key, eventTimestamp || Date.now());
      }

      latestMessageTimestamps.set(key, eventTimestamp || Date.now());
      return { shouldProcess: true };
    },
  };
}

export function shouldThrottleRealtimeSend(lastSentAt: number, now = Date.now(), throttleMs = REALTIME_TYPING_THROTTLE_MS) {
  return lastSentAt > 0 && now - lastSentAt < throttleMs;
}

export type SubscribeToChannelMessagesInput = Readonly<{
  communityId: string;
  channelId: string;
  onInsert?: (message: MessageSummary) => void;
  onUpdate?: (message: MessageSummary) => void;
  onDelete?: (message: MessageSummary) => void;
  onStatusChange?: (status: RealtimeConnectionStatus) => void;
  onError?: (message: string) => void;
}>;

export function subscribeToChannelMessages(input: SubscribeToChannelMessagesInput): () => void {
  const client = getSupabaseClient();

  if (!client) {
    input.onStatusChange?.("disconnected");
    input.onError?.("Supabase Realtime is unavailable because the Supabase client is not configured.");
    return () => undefined;
  }

  let hasConnected = false;
  input.onStatusChange?.("connecting");

  const channel = client
    .channel(realtimeChannelNames.messages(input.communityId, input.channelId))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `channel_id=eq.${input.channelId}`,
      },
      (payload) => input.onInsert?.(mapMessageRow(payload.new as MessageRow)),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `channel_id=eq.${input.channelId}`,
      },
      (payload) => input.onUpdate?.(mapMessageRow(payload.new as MessageRow)),
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "messages",
        filter: `channel_id=eq.${input.channelId}`,
      },
      (payload) => input.onDelete?.(mapMessageRow(payload.old as MessageRow)),
    )
    .subscribe((status) => {
      const mappedStatus = mapRealtimeSubscriptionStatus(status, hasConnected);
      if (mappedStatus === "connected") {
        hasConnected = true;
      }
      if (mappedStatus) {
        input.onStatusChange?.(mappedStatus);
      }
    });

  return () => {
    void channel.unsubscribe();
  };
}
