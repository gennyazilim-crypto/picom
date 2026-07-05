import { appConfig } from "../config/appConfig";
import { loggingService } from "./loggingService";

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
  source: appConfig.dataSource === "mock" ? "mock" : "fallback",
};

function emit(next: MaintenanceStatusSnapshot): MaintenanceStatusSnapshot {
  snapshot = next;
  for (const listener of listeners) {
    listener(snapshot);
  }

  return snapshot;
}

function getStatusUrl(): string | null {
  if (!appConfig.supabase.url || appConfig.dataSource === "mock") {
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
      return emit({
        status: "operational",
        message: "Mock mode is active; scheduled maintenance checks are skipped.",
        checkedAt: new Date().toISOString(),
        source: "mock",
      });
    }

    try {
      const response = await fetchWithTimeout(statusUrl, timeoutMs);
      const body = await response.json().catch(() => ({}));
      const status = response.ok ? toServiceStatus(body.status) : "degraded";

      return emit({
        status,
        message: typeof body.message === "string" ? body.message : response.ok ? "Picom services are operational." : "Picom service status is degraded.",
        startedAt: typeof body.startedAt === "string" ? body.startedAt : null,
        estimatedEndAt: typeof body.estimatedEndAt === "string" ? body.estimatedEndAt : null,
        checkedAt: new Date().toISOString(),
        source: "supabase",
      });
    } catch (error) {
      loggingService.logWarn("Maintenance status check failed", { error }, "maintenance-status");
      return emit({
        status: "degraded",
        message: "Picom service status could not be checked. Core mock UI remains available.",
        checkedAt: new Date().toISOString(),
        source: "fallback",
      });
    }
  },
};
