import { appConfig } from "../../config/appConfig";
import { loggingService, type LogEntry } from "../logging/loggingService";
import type { RealtimeConnectionStatus } from "../supabase/realtimeService";
import { voiceService, type VoiceConnectionStatus } from "../voiceService";
import type { VoiceConnectionQuality, VoiceDurationBucket } from "../../utils/voiceQualityMetrics";

export type DiagnosticsRealtimeStatus = RealtimeConnectionStatus | "unknown";
export type SupabaseDiagnosticsStatus = "mock" | "configured" | "not_configured";

export type DiagnosticsErrorSummary = Readonly<{
  id: string;
  timestamp: string;
  message: string;
  source?: string;
}>;

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
    window: { width: number | null; height: number | null; focused: boolean };
  };
  serviceStatus: {
    realtimeStatus: DiagnosticsRealtimeStatus;
    supabaseStatus: SupabaseDiagnosticsStatus;
    supabaseHost: string | null;
    liveKitStatus: "configured" | "not_configured";
    voiceStatus: VoiceConnectionStatus;
    voice: {
      participantCount: number;
      muted: boolean;
      deafened: boolean;
      screenSharing: boolean;
      connectionQuality: VoiceConnectionQuality;
      reconnectCount: number;
      joinFailureCount: number;
      deviceErrorCount: number;
      sessionDurationBucket: VoiceDurationBucket;
    };
    authState: "authenticated" | "signed_out";
    activeView: string;
    activeCommunityId: string | null;
    activeChannelId: string | null;
    lastApiError: DiagnosticsErrorSummary | null;
  };
  recentErrors: DiagnosticsErrorSummary[];
}>;

export type DiagnosticsExportPayload = Readonly<{
  schemaVersion: 1;
  createdAt: string;
  app: DiagnosticsSnapshot["app"];
  runtime: DiagnosticsSnapshot["runtime"];
  serviceStatus: Omit<DiagnosticsSnapshot["serviceStatus"], "activeCommunityId" | "activeChannelId">;
  recentErrors: DiagnosticsErrorSummary[];
  recentLogs: LogEntry[];
  note: string;
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

function getRecentErrors(limit = 20): DiagnosticsErrorSummary[] {
  return loggingService.getRecentLogs(100)
    .filter((entry) => entry.level === "error")
    .slice(-limit)
    .reverse()
    .map((entry) => ({ id: entry.id, timestamp: entry.timestamp, message: entry.message, source: entry.source }));
}

function getSupabaseStatus(): SupabaseDiagnosticsStatus {
  if (appConfig.dataSource === "mock") return "mock";
  return appConfig.supabase.url && appConfig.supabase.anonKey ? "configured" : "not_configured";
}

function formatExportAsText(payload: DiagnosticsExportPayload): string {
  const lines = [
    "Picom diagnostics",
    `Created: ${payload.createdAt}`,
    `Version: ${payload.app.version}`,
    `Release channel: ${payload.app.releaseChannel}`,
    `Environment: ${payload.app.environment}`,
    `Platform: ${payload.runtime.platform}`,
    `Electron: ${payload.runtime.electronVersion ?? "browser fallback"}`,
    `Current view: ${payload.serviceStatus.activeView}`,
    `Supabase: ${payload.serviceStatus.supabaseStatus}`,
    `Realtime: ${payload.serviceStatus.realtimeStatus}`,
    `LiveKit: ${payload.serviceStatus.liveKitStatus}`,
    `Voice: ${payload.serviceStatus.voiceStatus}`,
    `Voice quality: ${payload.serviceStatus.voice.connectionQuality}`,
    `Voice reconnects: ${payload.serviceStatus.voice.reconnectCount}`,
    `Voice device errors: ${payload.serviceStatus.voice.deviceErrorCount}`,
    "",
    "Recent errors:",
    ...(payload.recentErrors.length ? payload.recentErrors.map((entry) => `${entry.timestamp} [${entry.source ?? "client"}] ${entry.message}`) : ["None"]),
    "",
    "Recent redacted logs:",
    loggingService.exportLogs("text", payload.recentLogs.length) || "None",
    "",
    payload.note,
  ];
  return lines.join("\n");
}

export const diagnosticsService = {
  setRealtimeStatus(status: DiagnosticsRealtimeStatus): void {
    realtimeStatus = status;
  },
  setAppContext(context: { activeView: string; activeCommunityId?: string | null; activeChannelId?: string | null; authState?: "authenticated" | "signed_out" }): void {
    appContext = { activeView: context.activeView, activeCommunityId: context.activeCommunityId ?? null, activeChannelId: context.activeChannelId ?? null, authState: context.authState ?? appContext.authState };
  },
  getSnapshot(): DiagnosticsSnapshot {
    const recentErrors = getRecentErrors();
    const supabaseHost = safeUrlHost(appConfig.supabase.url);
    const lastApiError = recentErrors.find((entry) => /api|supabase|network|auth|storage|realtime/i.test(`${entry.source ?? ""} ${entry.message}`)) ?? null;
    const voiceDiagnostics = voiceService.getDiagnosticsSummary();
    return {
      app: {
        name: appConfig.name,
        identifier: appConfig.identifier,
        version: appConfig.version,
        environment: appConfig.environment,
        releaseChannel: appConfig.releaseChannel,
        buildDate: appConfig.build.date,
        commitShort: appConfig.build.commitShort,
        dataSource: appConfig.dataSource,
        runtimeTarget: appConfig.runtimeTarget,
      },
      runtime: {
        userAgent: safeNavigatorValue("userAgent", "unknown"),
        platform: safeNavigatorValue("platform", "unknown"),
        electronVersion: typeof window === "undefined" ? null : window.picomDesktop?.getRuntimeInfo().versions.electron ?? null,
        language: safeNavigatorValue("language", "en"),
        online: isOnline(),
        window: { width: typeof window === "undefined" ? null : window.innerWidth, height: typeof window === "undefined" ? null : window.innerHeight, focused: typeof document === "undefined" ? false : document.hasFocus() },
      },
      serviceStatus: {
        realtimeStatus,
        supabaseStatus: getSupabaseStatus(),
        supabaseHost,
        liveKitStatus: appConfig.liveKit.url ? "configured" : "not_configured",
        voiceStatus: voiceDiagnostics.status,
        voice: {
          participantCount: voiceDiagnostics.participantCount,
          muted: voiceDiagnostics.muted,
          deafened: voiceDiagnostics.deafened,
          screenSharing: voiceDiagnostics.screenSharing,
          connectionQuality: voiceDiagnostics.connectionQuality,
          reconnectCount: voiceDiagnostics.reconnectCount,
          joinFailureCount: voiceDiagnostics.joinFailureCount,
          deviceErrorCount: voiceDiagnostics.deviceErrorCount,
          sessionDurationBucket: voiceDiagnostics.sessionDurationBucket,
        },
        authState: appContext.authState,
        activeView: appContext.activeView,
        activeCommunityId: appContext.activeCommunityId,
        activeChannelId: appContext.activeChannelId,
        lastApiError,
      },
      recentErrors,
    };
  },
  createExportPayload(options: { recentLogLimit?: number } = {}): DiagnosticsExportPayload {
    const snapshot = this.getSnapshot();
    const { activeCommunityId: _activeCommunityId, activeChannelId: _activeChannelId, ...safeServiceStatus } = snapshot.serviceStatus;
    return loggingService.redactDiagnosticsValue({
      schemaVersion: 1 as const,
      createdAt: new Date().toISOString(),
      app: snapshot.app,
      runtime: snapshot.runtime,
      serviceStatus: safeServiceStatus,
      recentErrors: snapshot.recentErrors,
      recentLogs: loggingService.getRecentLogs(options.recentLogLimit ?? 75),
      note: "Redacted Picom diagnostics. Passwords, tokens, cookies, authorization headers, service-role keys, private keys, LiveKit secrets, and private message content fields are excluded.",
    });
  },
  exportDiagnostics(format: "json" | "text" = "json", options: { recentLogLimit?: number } = {}): string {
    const payload = this.createExportPayload(options);
    return format === "text" ? formatExportAsText(payload) : JSON.stringify(payload, null, 2);
  },
};
