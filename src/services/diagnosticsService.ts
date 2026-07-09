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
    buildDate: string;
    commitShort: string;
    dataSource: string;
    runtimeTarget: string;
  };
  runtime: {
    userAgent: string;
    platform: string;
    electronVersion: string | null;
    language: string;
    online: boolean;
  };
  serviceStatus: {
    realtimeStatus: DiagnosticsRealtimeStatus;
    supabaseHost: string | null;
    liveKitStatus: "configured" | "not_configured";
    authState: "authenticated" | "signed_out";
    activeView: string;
    activeCommunityId: string | null;
    activeChannelId: string | null;
    lastApiError: null | {
      id: string;
      timestamp: string;
      message: string;
      source?: string;
    };
  };
}>;

let realtimeStatus: DiagnosticsRealtimeStatus = "unknown";
let appContext = { activeView: "startup", activeCommunityId: null as string | null, activeChannelId: null as string | null, authState: "signed_out" as "authenticated" | "signed_out" };

function safeUrlHost(value: string): string | null {
  if (!value) return null;
  try { return new URL(value).host; } catch { return null; }
}

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

  setAppContext(context: { activeView: string; activeCommunityId?: string | null; activeChannelId?: string | null; authState?: "authenticated" | "signed_out" }): void {
    appContext = { activeView: context.activeView, activeCommunityId: context.activeCommunityId ?? null, activeChannelId: context.activeChannelId ?? null, authState: context.authState ?? appContext.authState };
  },

  getSnapshot(): DiagnosticsSnapshot {
    return {
      app: {
        name: appConfig.name,
        identifier: appConfig.identifier,
        version: import.meta.env.VITE_APP_VERSION ?? "0.1.0",
        environment: appConfig.environment,
        releaseChannel: appConfig.releaseChannel,
        buildDate: appConfig.build.date,
        commitShort: appConfig.build.commitShort,
        dataSource: appConfig.dataSource,
        runtimeTarget: appConfig.runtimeTarget
      },
      runtime: {
        userAgent: safeNavigatorValue("userAgent", "unknown"),
        platform: safeNavigatorValue("platform", "unknown"),
        electronVersion: typeof window === "undefined" ? null : window.picomDesktop?.getRuntimeInfo().versions.electron ?? null,
        language: safeNavigatorValue("language", "en"),
        online: isOnline()
      },
      serviceStatus: {
        realtimeStatus,
        supabaseHost: safeUrlHost(appConfig.supabase.url),
        liveKitStatus: appConfig.liveKit.url ? "configured" : "not_configured",
        authState: appContext.authState,
        activeView: appContext.activeView,
        activeCommunityId: appContext.activeCommunityId,
        activeChannelId: appContext.activeChannelId,
        lastApiError: getLastApiError()
      }
    };
  }
};
