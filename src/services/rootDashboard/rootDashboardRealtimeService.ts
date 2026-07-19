import { networkStatusService, type NetworkState } from "../networkStatusService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type RootDashboardRealtimeStatus =
  | "idle"
  | "connecting"
  | "subscribed"
  | "reconnecting"
  | "offline"
  | "error";

export type RootDashboardRealtimeSnapshot = Readonly<{
  status: RootDashboardRealtimeStatus;
  lastEventAt: string | null;
  channel: string | null;
  detail: string | null;
}>;

type Listener = (snapshot: RootDashboardRealtimeSnapshot) => void;

const listeners = new Set<Listener>();
let snapshot: RootDashboardRealtimeSnapshot = {
  status: "idle",
  lastEventAt: null,
  channel: null,
  detail: null,
};
let unsubscribeNetwork: (() => void) | null = null;
let activeChannel: { unsubscribe: () => void } | null = null;

function publish(next: RootDashboardRealtimeSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener(snapshot);
}

/**
 * Best-effort dashboard freshness channel. Uses network state always;
 * when Supabase realtime is available, joins a private dashboard topic.
 * Failures never fabricate data — UI shows reconnect/offline honestly.
 */
export const rootDashboardRealtimeService = {
  getSnapshot(): RootDashboardRealtimeSnapshot {
    return snapshot;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(snapshot);
    return () => {
      listeners.delete(listener);
    };
  },

  start(options: Readonly<{ enabled: boolean }>): () => void {
    this.stop();
    if (!options.enabled) {
      publish({ status: "idle", lastEventAt: null, channel: null, detail: null });
      return () => undefined;
    }

    unsubscribeNetwork = networkStatusService.subscribe((next) => {
      const state: NetworkState = next.state;
      if (state === "offline") {
        publish({
          status: "offline",
          lastEventAt: snapshot.lastEventAt,
          channel: snapshot.channel,
          detail: "Browser or backend network is offline.",
        });
        return;
      }
      if (snapshot.status === "offline" || snapshot.status === "error") {
        publish({
          status: "reconnecting",
          lastEventAt: snapshot.lastEventAt,
          channel: snapshot.channel,
          detail: "Attempting to restore dashboard realtime.",
        });
      }
    });

    const client = getSupabaseClient();
    if (!client) {
      publish({
        status: "error",
        lastEventAt: null,
        channel: null,
        detail: "Supabase client unavailable for dashboard realtime.",
      });
      return () => this.stop();
    }

    publish({
      status: "connecting",
      lastEventAt: null,
      channel: "root-dashboard-ops",
      detail: "Connecting to dashboard freshness channel.",
    });

    const channel = client.channel("root-dashboard-ops", { config: { private: true } });
    channel
      .on("broadcast", { event: "dashboard_invalidate" }, () => {
        publish({
          status: "subscribed",
          lastEventAt: new Date().toISOString(),
          channel: "root-dashboard-ops",
          detail: "Received dashboard invalidate event.",
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          publish({
            status: "subscribed",
            lastEventAt: new Date().toISOString(),
            channel: "root-dashboard-ops",
            detail: "Subscribed. Waiting for invalidate events.",
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          publish({
            status: "reconnecting",
            lastEventAt: snapshot.lastEventAt,
            channel: "root-dashboard-ops",
            detail: `Realtime status: ${status}`,
          });
        }
      });

    activeChannel = {
      unsubscribe: () => {
        void client.removeChannel(channel);
      },
    };

    return () => this.stop();
  },

  stop() {
    unsubscribeNetwork?.();
    unsubscribeNetwork = null;
    activeChannel?.unsubscribe();
    activeChannel = null;
    publish({ status: "idle", lastEventAt: null, channel: null, detail: null });
  },
};
