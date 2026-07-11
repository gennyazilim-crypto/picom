import type { RealtimeChannel } from "@supabase/supabase-js";
import { dataSourceService } from "../dataSourceService";
import { createRealtimeEventDeduper, mapRealtimeSubscriptionStatus, realtimeChannelNames, type RealtimeConnectionStatus } from "../supabase/realtimeService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";

export type PodcastRealtimeTable = "podcast_episodes" | "podcast_episode_reactions" | "podcast_episode_comments" | "saved_audio_items" | "podcast_playback_progress";
export type PodcastRealtimeEvent = Readonly<{ table: PodcastRealtimeTable; eventType: "INSERT" | "UPDATE" | "DELETE"; rowId: string; serverTimestamp: string }>;
type Subscriber = Readonly<{ onEvent: (event: PodcastRealtimeEvent) => void; onStatus: (status: RealtimeConnectionStatus) => void; onError?: (message: string) => void }>;

const subscribers = new Set<Subscriber>();
const deduper = createRealtimeEventDeduper(800);
const tables: readonly PodcastRealtimeTable[] = ["podcast_episodes", "podcast_episode_reactions", "podcast_episode_comments", "saved_audio_items", "podcast_playback_progress"];
let stopTransport: (() => void) | null = null;
let currentStatus: RealtimeConnectionStatus = "idle";

function emitStatus(status: RealtimeConnectionStatus) { currentStatus = status; for (const subscriber of subscribers) subscriber.onStatus(status); }
function emitError(message: string) { for (const subscriber of subscribers) subscriber.onError?.(message); }
function emitEvent(event: PodcastRealtimeEvent) {
  const eventId = `${event.table}:${event.eventType}:${event.rowId}:${event.serverTimestamp}`;
  if (!deduper.shouldProcess(eventId)) return;
  for (const subscriber of subscribers) subscriber.onEvent(event);
}

function startSupabaseTransport(): () => void {
  const status = getSupabaseClientStatus();
  const client = getSupabaseClient();
  if (!status.configured || !client) { emitStatus("disconnected"); emitError(status.reason ?? "Podcast Realtime is unavailable."); return () => undefined; }
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
    let nextChannel = client.channel(realtimeChannelNames.podcastCatalog(localGeneration));
    for (const table of tables) {
      nextChannel = nextChannel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        if (canceled || generation !== localGeneration) return;
        const nextRow = (payload.new ?? {}) as Record<string, unknown>;
        const oldRow = (payload.old ?? {}) as Record<string, unknown>;
        emitEvent({ table, eventType: payload.eventType, rowId: String(nextRow.id ?? oldRow.id ?? "unknown"), serverTimestamp: payload.commit_timestamp ?? String(nextRow.updated_at ?? nextRow.created_at ?? nextRow.last_played_at ?? new Date().toISOString()) });
      });
    }
    channel = nextChannel.subscribe((value) => {
      if (canceled || generation !== localGeneration) return;
      const mapped = mapRealtimeSubscriptionStatus(value, hasConnected);
      if (!mapped) return;
      if (mapped === "connected") { hasConnected = true; attempt = 0; emitStatus("connected"); return; }
      emitStatus(mapped);
      if ((value === "CHANNEL_ERROR" || value === "TIMED_OUT" || value === "CLOSED") && !retryTimer) {
        attempt += 1;
        const stale = channel; channel = null; if (stale) void client.removeChannel(stale);
        retryTimer = setTimeout(() => { retryTimer = null; connect(); }, Math.min(10_000, 750 * 2 ** Math.min(attempt, 4)));
      }
    });
  };
  connect();
  return () => { canceled = true; generation += 1; if (retryTimer) clearTimeout(retryTimer); if (channel) void client.removeChannel(channel); channel = null; deduper.clear(); };
}

function ensureTransport() {
  if (stopTransport || !subscribers.size) return;
  if (dataSourceService.getStatus().isMock) { emitStatus("connected"); stopTransport = () => { deduper.clear(); }; return; }
  stopTransport = startSupabaseTransport();
}

export const podcastRealtimeService = {
  subscribe(subscriber: Subscriber): () => void {
    subscribers.add(subscriber); subscriber.onStatus(currentStatus); ensureTransport();
    return () => { subscribers.delete(subscriber); if (!subscribers.size && stopTransport) { stopTransport(); stopTransport = null; currentStatus = "idle"; } };
  },
  publishMock(event: PodcastRealtimeEvent): void { if (dataSourceService.getStatus().isMock) emitEvent(event); },
};
