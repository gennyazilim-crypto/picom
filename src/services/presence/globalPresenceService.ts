import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { globalPresenceStore } from "../../stores/globalPresenceStore";
import type { PresencePreference } from "../../types/presence";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { mapRealtimeSubscriptionStatus } from "../supabase/realtimeService";
import { presencePreferenceService } from "./presencePreferenceService";

type ActivePresenceSession = {
  generation: number;
  userId: string;
  sessionId: string;
  client: SupabaseClient | null;
  channel: RealtimeChannel | null;
  heartbeat: ReturnType<typeof setInterval> | null;
  sharePresence: boolean;
};

let generation = 0;
let activeSession: ActivePresenceSession | null = null;
let sharingEnabled = true;

function createSessionId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    return (token === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function isCurrent(session: ActivePresenceSession): boolean {
  return activeSession?.generation === session.generation;
}

async function publish(session: ActivePresenceSession): Promise<void> {
  if (!isCurrent(session) || !session.client) return;
  const preference = presencePreferenceService.get();
  const visible = session.sharePresence && preference !== "invisible";
  const sessionStatus = preference === "invisible" ? "online" : preference;
  const observedAt = new Date().toISOString();

  if (session.channel) {
    await session.channel.track({ status: visible ? sessionStatus : "offline", visible, observed_at: observedAt });
  }
  const { error } = await session.client.rpc("set_my_presence_session", {
    target_session_id: session.sessionId,
    target_status: sessionStatus,
    share_presence: visible,
  });
  if (error && isCurrent(session)) globalPresenceStore.setConnection("connected", "Presence sync is temporarily unavailable.");
}

async function clearRemoteSession(session: ActivePresenceSession): Promise<void> {
  if (!session.client) return;
  await session.channel?.untrack();
  await session.client.rpc("clear_my_presence_session", { target_session_id: session.sessionId });
}

function stopSession(session: ActivePresenceSession): void {
  if (session.heartbeat) clearInterval(session.heartbeat);
  void clearRemoteSession(session);
  if (session.channel && session.client) void session.client.removeChannel(session.channel);
  if (isCurrent(session)) {
    activeSession = null;
    globalPresenceStore.setConnection("disconnected");
  }
}

async function connect(session: ActivePresenceSession): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !isCurrent(session)) {
    if (isCurrent(session)) globalPresenceStore.setConnection("disconnected", "Realtime presence is unavailable.");
    return;
  }
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== session.userId || !isCurrent(session)) {
    if (isCurrent(session)) globalPresenceStore.setConnection("disconnected", "Presence session authentication failed.");
    return;
  }

  session.client = client;
  let connected = false;
  const channel = client
    .channel(`presence:session:${session.sessionId}`, { config: { presence: { key: session.sessionId } } })
    .on("presence", { event: "sync" }, () => undefined)
    .subscribe((status) => {
      if (!isCurrent(session)) return;
      const mapped = mapRealtimeSubscriptionStatus(status, connected);
      if (!mapped) return;
      if (mapped === "connected") {
        connected = true;
        globalPresenceStore.setConnection("connected");
        void publish(session);
        if (!session.heartbeat) session.heartbeat = setInterval(() => void publish(session), 30_000);
        return;
      }
      globalPresenceStore.setConnection(mapped === "idle" ? "disconnected" : mapped);
    });
  session.channel = channel;
}

presencePreferenceService.subscribe((preference) => {
  globalPresenceStore.setPreference(preference);
  if (activeSession) void publish(activeSession);
});
globalPresenceStore.setPreference(presencePreferenceService.get());

export const globalPresenceService = {
  start(userId: string): () => void {
    if (activeSession) stopSession(activeSession);
    const session: ActivePresenceSession = { generation: ++generation, userId, sessionId: createSessionId(), client: null, channel: null, heartbeat: null, sharePresence: sharingEnabled };
    activeSession = session;
    globalPresenceStore.setConnection("connecting");
    if (dataSourceService.getStatus().isMock) globalPresenceStore.setConnection("connected");
    else void connect(session);
    return () => { if (isCurrent(session)) stopSession(session); };
  },
  stop(): void {
    if (activeSession) stopSession(activeSession);
    else globalPresenceStore.setConnection("disconnected");
  },
  setPreference(preference: PresencePreference): void {
    presencePreferenceService.set(preference);
  },
  setSharingEnabled(enabled: boolean): void {
    sharingEnabled = enabled;
    if (!activeSession) return;
    activeSession.sharePresence = enabled;
    void publish(activeSession);
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => globalPresenceService.stop(), { capture: true });
}
