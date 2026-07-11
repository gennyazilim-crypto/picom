import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { realtimeChannelNames } from "../supabase/realtimeService";

export type FeedRealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";
export type FeedRealtimeEvent = Readonly<{
  reason: "change" | "reconnect";
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE" | "RECONNECT";
  sourceId?: string;
}>;
export type FeedRealtimeHandlers = Readonly<{
  onInvalidate: (event: FeedRealtimeEvent) => void;
  onStatus?: (status: FeedRealtimeStatus) => void;
  onError?: (message: string) => void;
}>;

const tables = [
  "content_mentions",
  "messages",
  "message_reactions",
  "read_states",
  "saved_messages",
  "user_follows",
  "audio_feed_read_states",
  "saved_audio_items",
  "radio_sessions",
  "radio_session_reactions",
  "podcast_episodes",
  "podcast_episode_reactions",
  "podcast_episode_comments",
] as const;

let diagnostics = { status: "idle" as FeedRealtimeStatus, lastEventAt: null as string | null, invalidationCount: 0, reconnectCount: 0 };

function sourceIdFor(table: string, payload: { new?: unknown; old?: unknown }) {
  const row = ((payload.new && typeof payload.new === "object" ? payload.new : payload.old) ?? {}) as Record<string, unknown>;
  if (table === "content_mentions") return typeof row.source_id === "string" ? row.source_id : undefined;
  if (table === "messages") return typeof row.id === "string" ? row.id : undefined;
  return undefined;
}

export const feedRealtimeService = {
  async subscribe(handlers: FeedRealtimeHandlers): Promise<() => void> {
    if (dataSourceService.getStatus().isMock) {
      diagnostics = { ...diagnostics, status: "connected" };
      queueMicrotask(() => handlers.onStatus?.("connected"));
      return () => { diagnostics = { ...diagnostics, status: "idle" }; };
    }
    const client = getSupabaseClient();
    if (!client) { handlers.onError?.("Feed realtime is unavailable until Picom reconnects."); return () => undefined; }
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) { handlers.onError?.("Sign in again to restore Feed realtime."); return () => undefined; }

    let active = true;
    let connectedOnce = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingEvent: FeedRealtimeEvent | null = null;
    const setStatus = (status: FeedRealtimeStatus) => { diagnostics = { ...diagnostics, status }; handlers.onStatus?.(status); };
    const schedule = (event: FeedRealtimeEvent) => {
      if (!active) return;
      pendingEvent = event;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (!active || !pendingEvent) return;
        const next = pendingEvent;
        pendingEvent = null;
        diagnostics = { ...diagnostics, lastEventAt: new Date().toISOString(), invalidationCount: diagnostics.invalidationCount + 1, reconnectCount: diagnostics.reconnectCount + (next.reason === "reconnect" ? 1 : 0) };
        handlers.onInvalidate(next);
      }, 120);
    };

    setStatus("connecting");
    const channel = client.channel(realtimeChannelNames.feed(data.user.id));
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        schedule({ reason: "change", table, eventType: payload.eventType, sourceId: sourceIdFor(table, payload) });
      });
    }
    channel.subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        setStatus("connected");
        if (connectedOnce) schedule({ reason: "reconnect", table: "feed", eventType: "RECONNECT" });
        connectedOnce = true;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStatus(connectedOnce ? "reconnecting" : "error");
      else if (status === "CLOSED") setStatus("disconnected");
    });

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      setStatus("idle");
      void client.removeChannel(channel);
    };
  },
  diagnostics() { return { ...diagnostics }; },
};
