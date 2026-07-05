import { appConfig } from "../config/appConfig";
import { loggingService } from "./loggingService";
import type { RealtimeConnectionStatus } from "./supabase/realtimeService";

export type DiagnosticsRealtimeStatus = RealtimeConnectionStatus | "unknown";

export type DiagnosticsSnapshot = Readonly<{
  app: {
    name: string;
    identifier: string;
    version: string;
    environment: string;
    releaseChannel: string;
    dataSource: string;
    runtimeTarget: string;
  };
  runtime: {
    userAgent: string;
    platform: string;
    language: string;
    online: boolean;
  };
  serviceStatus: {
    realtimeStatus: DiagnosticsRealtimeStatus;
    lastApiError: null | {
      id: string;
      timestamp: string;
      message: string;
      source?: string;
    };
  };
}>;

let realtimeStatus: DiagnosticsRealtimeStatus = "unknown";

function safeNavigatorValue<K extends keyof Navigator>(key: K, fallback: string): string {
  if (typeof navigator === "undefined") return fallback;
  const value = navigator[key];
  return typeof value === "string" ? value : fallback;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function getLastApiError(): DiagnosticsSnapshot["serviceStatus"]["lastApiError"] {
  const entry = loggingService.getRecentLogs(100).reverse().find((candidate) => {
    if (candidate.level !== "error") return false;

    const source = candidate.source ?? "";
    return /api|supabase|network|auth|storage|realtime/i.test(`${source} ${candidate.message}`);
  });

  if (!entry) return null;

  return {
    id: entry.id,
    timestamp: entry.timestamp,
    message: entry.message,
    source: entry.source
  };
}

export const diagnosticsService = {
  setRealtimeStatus(status: DiagnosticsRealtimeStatus): void {
    realtimeStatus = status;
  },

  getSnapshot(): DiagnosticsSnapshot {
    return {
      app: {
        name: appConfig.name,
        identifier: appConfig.identifier,
        version: import.meta.env.VITE_APP_VERSION ?? "0.1.0",
        environment: appConfig.environment,
        releaseChannel: appConfig.releaseChannel,
        dataSource: appConfig.dataSource,
        runtimeTarget: appConfig.runtimeTarget
      },
      runtime: {
        userAgent: safeNavigatorValue("userAgent", "unknown"),
        platform: safeNavigatorValue("platform", "unknown"),
        language: safeNavigatorValue("language", "en"),
        online: isOnline()
      },
      serviceStatus: {
        realtimeStatus,
        lastApiError: getLastApiError()
      }
    };
  }
};
