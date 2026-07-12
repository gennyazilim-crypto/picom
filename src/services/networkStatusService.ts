import { appConfig } from "../config/appConfig";
import { loggingService } from "./loggingService";
import { dataSourceService } from "./dataSourceService";

export type NetworkState = "online" | "offline" | "backend_unreachable" | "degraded" | "checking";

export type NetworkStatusSnapshot = Readonly<{
  state: NetworkState;
  browserOnline: boolean;
  backendReachable: boolean | null;
  checkedAt: string | null;
  reason?: string;
}>;

type NetworkStatusListener = (snapshot: NetworkStatusSnapshot) => void;

const listeners = new Set<NetworkStatusListener>();
let cleanupBrowserListeners: (() => void) | null = null;
let healthTimer: ReturnType<typeof setInterval> | null = null;

let snapshot: NetworkStatusSnapshot = {
  state: typeof navigator === "undefined" || navigator.onLine ? "online" : "offline",
  browserOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  backendReachable: null,
  checkedAt: null
};

function emit(next: NetworkStatusSnapshot): NetworkStatusSnapshot {
  snapshot = next;
  for (const listener of listeners) {
    listener(snapshot);
  }

  return snapshot;
}

function getHealthUrl(): string | null {
  const status = dataSourceService.getStatus();
  if (!status.isSupabase || !status.configured || !appConfig.supabase.url) {
    return null;
  }

  return `${appConfig.supabase.url.replace(/\/+$/, "")}/auth/v1/health`;
}

function getBrowserOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export const networkStatusService = {
  getSnapshot(): NetworkStatusSnapshot {
    return snapshot;
  },

  subscribe(listener: NetworkStatusListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  start(options: { healthCheckIntervalMs?: number } = {}): () => void {
    if (!cleanupBrowserListeners) {
      const updateFromBrowser = () => {
        const browserOnline = getBrowserOnline();
        emit({
          ...snapshot,
          state: browserOnline ? "online" : "offline",
          browserOnline,
          backendReachable: browserOnline ? snapshot.backendReachable : false,
          checkedAt: new Date().toISOString(),
          reason: browserOnline ? undefined : "Browser reports offline."
        });
      };

      window.addEventListener("online", updateFromBrowser);
      window.addEventListener("offline", updateFromBrowser);
      cleanupBrowserListeners = () => {
        window.removeEventListener("online", updateFromBrowser);
        window.removeEventListener("offline", updateFromBrowser);
        cleanupBrowserListeners = null;
      };
    }

    if (options.healthCheckIntervalMs && !healthTimer) {
      healthTimer = window.setInterval(() => {
        void networkStatusService.checkBackendHealth();
      }, Math.max(15_000, options.healthCheckIntervalMs));
    }

    return () => {
      cleanupBrowserListeners?.();
      if (healthTimer) {
        window.clearInterval(healthTimer);
        healthTimer = null;
      }
    };
  },

  async checkBackendHealth(timeoutMs = 3500): Promise<NetworkStatusSnapshot> {
    const browserOnline = getBrowserOnline();
    if (!browserOnline) {
      return emit({
        state: "offline",
        browserOnline,
        backendReachable: false,
        checkedAt: new Date().toISOString(),
        reason: "Browser reports offline."
      });
    }

    const healthUrl = getHealthUrl();
    if (!healthUrl) {
      const dataSource = dataSourceService.getStatus();
      return emit({
        state: dataSource.isMock ? "online" : "backend_unreachable",
        browserOnline,
        backendReachable: dataSource.isMock ? null : false,
        checkedAt: new Date().toISOString(),
        reason: dataSource.isMock ? "Backend health check skipped in explicit mock mode." : dataSource.reason ?? "Supabase backend is not configured."
      });
    }

    emit({
      ...snapshot,
      state: "checking",
      browserOnline,
      checkedAt: new Date().toISOString()
    });

    try {
      const response = await fetchWithTimeout(healthUrl, timeoutMs);
      return emit({
        state: response.ok ? "online" : "degraded",
        browserOnline,
        backendReachable: response.ok,
        checkedAt: new Date().toISOString(),
        reason: response.ok ? undefined : `Health endpoint returned ${response.status}.`
      });
    } catch (error) {
      loggingService.logWarn("Backend health check failed", { error }, "network-status");
      return emit({
        state: "backend_unreachable",
        browserOnline,
        backendReachable: false,
        checkedAt: new Date().toISOString(),
        reason: "Backend health endpoint is unreachable."
      });
    }
  }
};
