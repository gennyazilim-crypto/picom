import type { RealtimeChannel } from "@supabase/supabase-js";
import type { MeetingWaitingRealtimeEvent } from "../../types/meetingWaitingRoom";
import { dataSourceService } from "../dataSourceService";
import { createRealtimeEventDeduper, mapRealtimeSubscriptionStatus, type RealtimeConnectionStatus } from "../supabase/realtimeService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { mapMeetingWaitingEntry } from "./meetingWaitingRoomService";

export type MeetingWaitingRealtimeSubscriber = Readonly<{
  onEvent: (event: MeetingWaitingRealtimeEvent) => void;
  onStatus: (status: RealtimeConnectionStatus) => void;
  onError?: (message: string) => void;
}>;

const mockSubscribers = new Set<{ roomId: string; subscriber: MeetingWaitingRealtimeSubscriber }>();

export const meetingWaitingRoomRealtimeService = {
  subscribe(roomId: string, subscriber: MeetingWaitingRealtimeSubscriber): () => void {
    if (!/^[0-9a-z-]{8,80}$/i.test(roomId)) { subscriber.onStatus("disconnected"); subscriber.onError?.("The meeting room identifier is invalid."); return () => undefined; }
    if (dataSourceService.getStatus().isMock) { const item = { roomId, subscriber }; mockSubscribers.add(item); subscriber.onStatus("connected"); return () => { mockSubscribers.delete(item); }; }
    const status = getSupabaseClientStatus(), client = getSupabaseClient();
    if (!status.configured || !client) { subscriber.onStatus("disconnected"); subscriber.onError?.(status.reason ?? "Meeting waiting-room Realtime is unavailable."); return () => undefined; }
    const deduper = createRealtimeEventDeduper(500); let channel: RealtimeChannel | null = null; let retryTimer: ReturnType<typeof setTimeout> | null = null; let attempt = 0; let generation = 0; let canceled = false;
    const connect = () => {
      if (canceled) return; const localGeneration = ++generation; let connected = false; subscriber.onStatus(attempt ? "reconnecting" : "connecting");
      channel = client.channel(`meeting-waiting:${roomId}:${localGeneration}`).on("postgres_changes", { event: "*", schema: "public", table: "meeting_waiting_entries", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (canceled || generation !== localGeneration) return; const entry = mapMeetingWaitingEntry(payload.eventType === "DELETE" ? payload.old : payload.new); if (!entry) return;
        const serverTimestamp = payload.commit_timestamp ?? entry.updatedAt; const eventId = `${payload.eventType}:${entry.id}:${entry.status}:${serverTimestamp}`; if (!deduper.shouldProcess(eventId)) return;
        subscriber.onEvent({ eventType: payload.eventType, entry, serverTimestamp });
      }).subscribe((value) => {
        if (canceled || generation !== localGeneration) return; const mapped = mapRealtimeSubscriptionStatus(value, connected); if (!mapped) return;
        if (mapped === "connected") { connected = true; attempt = 0; subscriber.onStatus("connected"); return; } subscriber.onStatus(mapped);
        if ((value === "CHANNEL_ERROR" || value === "TIMED_OUT" || value === "CLOSED") && !retryTimer) { attempt += 1; const stale = channel; channel = null; if (stale) void client.removeChannel(stale); retryTimer = setTimeout(() => { retryTimer = null; connect(); }, Math.min(10_000, 750 * 2 ** Math.min(attempt, 4))); }
      });
    };
    connect();
    return () => { canceled = true; generation += 1; if (retryTimer) clearTimeout(retryTimer); if (channel) void client.removeChannel(channel); channel = null; deduper.clear(); };
  },

  publishMock(event: MeetingWaitingRealtimeEvent): void {
    if (!dataSourceService.getStatus().isMock) return;
    for (const item of mockSubscribers) if (item.roomId === event.entry.roomId) item.subscriber.onEvent(event);
  },
};
