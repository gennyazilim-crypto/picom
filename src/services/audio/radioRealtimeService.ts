import type { RealtimeChannel } from "@supabase/supabase-js";
import { dataSourceService } from "../dataSourceService";
import { createRealtimeEventDeduper, mapRealtimeSubscriptionStatus, realtimeChannelNames, type RealtimeConnectionStatus } from "../supabase/realtimeService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";

export type RadioRealtimeTable = "radio_sessions" | "radio_listeners" | "radio_session_reactions" | "radio_program_schedules" | "radio_program_hosts" | "radio_session_hosts";
export type RadioRealtimeEvent = Readonly<{ table: RadioRealtimeTable; eventType: "INSERT" | "UPDATE" | "DELETE"; rowId: string; serverTimestamp: string }>;
type Subscriber = Readonly<{ onEvent: (event: RadioRealtimeEvent) => void; onStatus: (status: RealtimeConnectionStatus) => void; onError?: (message: string) => void }>;

const subscribers = new Set<Subscriber>();
const deduper = createRealtimeEventDeduper(800);
const tables: readonly RadioRealtimeTable[] = ["radio_sessions", "radio_listeners", "radio_session_reactions", "radio_program_schedules", "radio_program_hosts", "radio_session_hosts"];
let stopTransport: (() => void) | null = null;
let currentStatus: RealtimeConnectionStatus = "idle";

function emitStatus(status: RealtimeConnectionStatus) {
  currentStatus = status;
  for (const subscriber of subscribers) subscriber.onStatus(status);
}

function emitError(message: string) {
  for (const subscriber of subscribers) subscriber.onError?.(message);
}

function emitEvent(event: RadioRealtimeEvent) {
  const eventId = `${event.table}:${event.eventType}:${event.rowId}:${event.serverTimestamp}`;
  if (!deduper.shouldProcess(eventId)) return;
  for (const subscriber of subscribers) subscriber.onEvent(event);
}

function startSupabaseTransport(): () => void {
  const status = getSupabaseClientStatus();
  const client = getSupabaseClient();
  if (!status.configured || !client) {
    emitStatus("disconnected");
    emitError(status.reason ?? "Supabase Realtime is unavailable.");
    return () => undefined;
  }

  let canceled = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let channel: RealtimeChannel | null = null;
  let attempt = 0;
  let generation = 0;

  const connect = () => {
    if (canceled) return;
    const localGeneration = ++generation;
    let hasConnected = false;
    emitStatus(attempt > 0 ? "reconnecting" : "connecting");
    let nextChannel = client.channel(realtimeChannelNames.radioCatalog(localGeneration));
    for (const table of tables) {
      nextChannel = nextChannel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        if (canceled || generation !== localGeneration) return;
        const nextRow = (payload.new ?? {}) as Record<string, unknown>;
        const oldRow = (payload.old ?? {}) as Record<string, unknown>;
        const rowId = String(nextRow.id ?? oldRow.id ?? "unknown");
        const serverTimestamp = payload.commit_timestamp ?? String(nextRow.updated_at ?? nextRow.created_at ?? nextRow.joined_at ?? new Date().toISOString());
        emitEvent({ table, eventType: payload.eventType, rowId, serverTimestamp });
      });
    }
    channel = nextChannel.subscribe((value) => {
      if (canceled || generation !== localGeneration) return;
      const mapped = mapRealtimeSubscriptionStatus(value, hasConnected);
      if (!mapped) return;
      if (mapped === "connected") {
        hasConnected = true;
        attempt = 0;
        emitStatus("connected");
        return;
      }
      emitStatus(mapped);
      if ((value === "CHANNEL_ERROR" || value === "TIMED_OUT" || value === "CLOSED") && !retryTimer) {
        attempt += 1;
        const delay = Math.min(10_000, 750 * 2 ** Math.min(attempt, 4));
        const staleChannel = channel;
        channel = null;
        if (staleChannel) void client.removeChannel(staleChannel);
        retryTimer = setTimeout(() => { retryTimer = null; connect(); }, delay);
      }
    });
  };

  connect();
  return () => {
    canceled = true;
    generation += 1;
    if (retryTimer) clearTimeout(retryTimer);
    if (channel) void client.removeChannel(channel);
    channel = null;
    deduper.clear();
  };
}

function ensureTransport() {
  if (stopTransport || !subscribers.size) return;
  if (dataSourceService.getStatus().isMock) {
    emitStatus("connected");
    stopTransport = () => { deduper.clear(); };
    return;
  }
  stopTransport = startSupabaseTransport();
}

export const radioRealtimeService = {
  subscribe(subscriber: Subscriber): () => void {
    subscribers.add(subscriber);
    subscriber.onStatus(currentStatus);
    ensureTransport();
    return () => {
      subscribers.delete(subscriber);
      if (!subscribers.size && stopTransport) {
        stopTransport();
        stopTransport = null;
        currentStatus = "idle";
      }
    };
  },
  publishMock(event: RadioRealtimeEvent): void {
    if (dataSourceService.getStatus().isMock) emitEvent(event);
  },
};
