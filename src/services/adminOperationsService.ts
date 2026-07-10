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
      recentErrors: logs.filter((entry) => entry.level === "error").slice(-12).reverse(),
      recentWarnings: logs.filter((entry) => entry.level === "warn").slice(-12).reverse(),
    };
  },
};
