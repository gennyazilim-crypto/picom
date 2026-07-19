import { appConfig } from "../config/appConfig";
import { loggingService } from "./loggingService";
import { dataSourceService } from "./dataSourceService";

export type MaintenanceServiceStatus = "operational" | "degraded" | "maintenance";

export type MaintenanceStatusSnapshot = Readonly<{
  status: MaintenanceServiceStatus;
  message: string;
  startedAt?: string | null;
  estimatedEndAt?: string | null;
  checkedAt: string | null;
  source: "mock" | "supabase" | "fallback";
}>;

type MaintenanceStatusListener = (snapshot: MaintenanceStatusSnapshot) => void;

const listeners = new Set<MaintenanceStatusListener>();

let snapshot: MaintenanceStatusSnapshot = {
  status: "operational",
  message: "Picom services are operational.",
  checkedAt: null,
  source: dataSourceService.getStatus().isMock ? "mock" : "fallback",
};

function emit(next: MaintenanceStatusSnapshot): MaintenanceStatusSnapshot {
  snapshot = next;
  for (const listener of listeners) {
    listener(snapshot);
  }

  return snapshot;
}

function getStatusUrl(): string | null {
  if (!dataSourceService.getStatus().configured || !dataSourceService.getStatus().isSupabase || !appConfig.supabase.url) {
    return null;
  }

  return `${appConfig.supabase.url.replace(/\/+$/, "")}/functions/v1/health`;
}

function toServiceStatus(value: unknown): MaintenanceServiceStatus {
  return value === "maintenance" || value === "degraded" || value === "operational" ? value : "operational";
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export const maintenanceStatusService = {
  getSnapshot(): MaintenanceStatusSnapshot {
    return snapshot;
  },

  subscribe(listener: MaintenanceStatusListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  async refresh(timeoutMs = 3500): Promise<MaintenanceStatusSnapshot> {
    const statusUrl = getStatusUrl();
    if (!statusUrl) {
      const dataSource = dataSourceService.getStatus();
      return emit({
        status: dataSource.isMock ? "operational" : "degraded",
        message: dataSource.isMock ? "Mock mode is active; scheduled maintenance checks are skipped." : dataSource.reason ?? "Supabase status checks are not configured.",
        checkedAt: new Date().toISOString(),
        source: dataSource.isMock ? "mock" : "fallback",
      });
    }

    try {
      const response = await fetchWithTimeout(statusUrl, timeoutMs);
      const body = await response.json().catch(() => ({}));
      // A missing status endpoint (404) means the optional health function is not
      // deployed in this environment, not that the backend is down. Only a real
      // server error (5xx) is treated as degraded.
      const status = response.ok ? toServiceStatus(body.status) : response.status >= 500 ? "degraded" : "operational";

      return emit({
        status,
        message: typeof body.message === "string" ? body.message : response.ok || response.status < 500 ? "Picom services are operational." : "Picom service status is degraded.",
        startedAt: typeof body.startedAt === "string" ? body.startedAt : null,
        estimatedEndAt: typeof body.estimatedEndAt === "string" ? body.estimatedEndAt : null,
        checkedAt: new Date().toISOString(),
        source: "supabase",
      });
    } catch (error) {
      // The status endpoint could not be reached (not deployed, CORS, or timeout).
      // The app's real data paths surface their own errors, so a failed best-effort
      // health check must not falsely claim that content is unavailable.
      loggingService.logWarn("Maintenance status check failed", { error }, "maintenance-status");
      return emit({
        status: "operational",
        message: "Picom services are running normally. The status check endpoint is currently unavailable.",
        checkedAt: new Date().toISOString(),
        source: "fallback",
      });
    }
  },
};
