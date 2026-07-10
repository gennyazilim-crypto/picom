import { mockCommunities } from "../data/mockCommunities";
import { appConfig } from "../config/appConfig";
import { attachmentQuarantineService } from "./attachmentQuarantineService";
import { abuseEventService } from "./abuseEventService";
import { crashReporterService } from "./crashReporterService";
import { dataSourceService } from "./dataSourceService";
import { diagnosticsService } from "./diagnosticsService";
import { loggingService } from "./loggingService";
import { networkStatusService } from "./networkStatusService";
import { reportService } from "./reportService";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { voiceService } from "./voiceService";

export type AdminOperationsAccess = Readonly<{ allowed: boolean; source: "development" | "app_admin" | "none" }>;

function countLogMatches(
  logs: ReturnType<typeof loggingService.getRecentLogs>,
  patterns: readonly RegExp[],
): number {
  return logs.filter((entry) => {
    const value = `${entry.source ?? ""} ${entry.message}`;
    return patterns.some((pattern) => pattern.test(value));
  }).length;
}

export const adminOperationsService = {
  async getAccess(): Promise<AdminOperationsAccess> { if (import.meta.env.DEV) return { allowed: true, source: "development" }; const client = getSupabaseClient(); if (!client) return { allowed: false, source: "none" }; const { data, error } = await client.rpc("is_app_admin"); return !error && data ? { allowed: true, source: "app_admin" } : { allowed: false, source: "none" }; },
  getSnapshot() {
    const users = new Set(mockCommunities.flatMap((community) => community.members.map((member) => member.userId)));
    const logs = loggingService.getRecentLogs(80);
    const network = networkStatusService.getSnapshot();
    const abuse = abuseEventService.getAdminSummary();
    const diagnostics = diagnosticsService.getSnapshot();
    const voiceQuality = voiceService.getDiagnosticsSummary();
    const recentErrors = logs.filter((entry) => entry.level === "error").slice(-12).reverse();
    const recentWarnings = logs.filter((entry) => entry.level === "warn").slice(-12).reverse();
    const apiStatus = dataSourceService.getStatus().isMock
      ? "mock"
      : network.state === "online" && network.backendReachable === true
        ? "operational"
        : network.state === "checking"
          ? "checking"
          : network.state;
    const uploadStatus = dataSourceService.getStatus().isMock
      ? "development"
      : diagnostics.serviceStatus.supabaseStatus !== "configured"
        ? "unavailable"
        : "unverified";

    return {
      dataSource: dataSourceService.getStatus().mode,
      visibleUsers: users.size,
      visibleCommunities: mockCommunities.length,
      reports: reportService.getSummary(),
      abuse,
      quarantine: attachmentQuarantineService.getAdminSummaryPlaceholder(),
      storageStatus: "Supabase Storage health requires backend diagnostics",
      network,
      realtimeStatus: network.state === "online" ? "available" : network.state,
      serviceHealth: Object.freeze({
        supabase: diagnostics.serviceStatus.supabaseStatus,
        supabaseHost: diagnostics.serviceStatus.supabaseHost,
        liveKit: diagnostics.serviceStatus.liveKitStatus,
        releaseChannel: diagnostics.app.releaseChannel,
        version: diagnostics.app.version,
      }),
      productHealth: Object.freeze({
        version: diagnostics.app.version,
        releaseChannel: diagnostics.app.releaseChannel,
        apiStatus,
        realtimeStatus: network.state === "online" ? "available" : network.state,
        uploadStatus,
        voiceStatus: diagnostics.serviceStatus.liveKitStatus,
        voiceConnectionQuality: voiceQuality.connectionQuality,
        voiceReconnectCount: voiceQuality.reconnectCount,
        voiceJoinFailureCount: voiceQuality.joinFailureCount,
        voiceDeviceErrorCount: voiceQuality.deviceErrorCount,
        voiceSessionDurationBucket: voiceQuality.sessionDurationBucket,
        errorCount: recentErrors.length,
        warningCount: recentWarnings.length,
        crashReportCount: crashReporterService.getStatus().queuedLocalRecords,
        checkedAt: network.checkedAt,
        source: "local_aggregate" as const,
      }),
      observability: Object.freeze({
        appStarts: countLogMatches(logs, [/app[- ]started/i, /startup complete/i]),
        authFailures: countLogMatches(logs, [/auth.*fail/i, /login.*fail/i]),
        messageSendFailures: countLogMatches(logs, [/message.*send.*fail/i, /send.*message.*fail/i]),
        realtimeReconnects: countLogMatches(logs, [/realtime.*reconnect/i, /reconnect.*realtime/i]),
        uploadFailures: countLogMatches(logs, [/upload.*fail/i, /attachment.*reject/i]),
        liveKitJoinFailures: countLogMatches(logs, [/livekit.*join.*fail/i, /voice.*join.*fail/i]),
        screenShareFailures: countLogMatches(logs, [/screen.*share.*fail/i]),
        rlsDeniedErrors: countLogMatches(logs, [/rls.*den/i, /row.level.security/i, /permission denied/i]),
        crashReports: crashReporterService.getStatus().queuedLocalRecords,
        abuseEvents: abuse.total,
        packageInfo: `${appConfig.version} - ${appConfig.releaseChannel}`,
        platform: `${appConfig.runtimeTarget} - ${navigator.platform || "unknown"}`,
        sampleWindow: logs.length,
      }),
      recentErrors,
      recentWarnings,
    };
  },
};
