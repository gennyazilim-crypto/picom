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
import { voiceDiagnosticsRegistry } from "./voiceDiagnosticsRegistry";
import type { AdminOperationsListItem, AdminOperationsListSection, AdminOperationsPage, AdminOperationsResult, AdminSystemStatusV2 } from "../types/adminOperations";

export type AdminOperationsAccess = Readonly<{ allowed: boolean; source: "development" | "app_admin" | "none" }>;
export type TrustSafetySummary = Readonly<{
  openReports: number;
  suspiciousUploads: number;
  pendingUploadReviews: number;
  abuseEvents: number;
  criticalAbuseEvents: number;
  rateLimitEvents: number;
  recentBans: number | null;
  recentKicks: number | null;
  windowHours: number;
  checkedAt: string;
  source: "local_aggregate" | "app_admin_rpc";
}>;

function countLogMatches(
  logs: ReturnType<typeof loggingService.getRecentLogs>,
  patterns: readonly RegExp[],
): number {
  return logs.filter((entry) => {
    const value = `${entry.source ?? ""} ${entry.message}`;
    return patterns.some((pattern) => pattern.test(value));
  }).length;
}

function asCount(value: unknown): number { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0; }
function asRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function encodeRemoteCursor(value: unknown): string | null { const row = asRecord(value); return row && typeof row.created_at === "string" && typeof row.id === "string" ? `${row.created_at}|${row.id}` : null; }
function decodeRemoteCursor(value: string | null | undefined): { createdAt: string | null; id: string | null } { if (!value) return { createdAt: null, id: null }; const separator = value.indexOf("|"); return separator > 0 ? { createdAt: value.slice(0, separator), id: value.slice(separator + 1) || null } : { createdAt: null, id: null }; }
function localAdminItems(section: AdminOperationsListSection): AdminOperationsListItem[] {
  const now = new Date().toISOString();
  if (section === "users") { const users = new Map<string, AdminOperationsListItem>(); for (const member of mockCommunities.flatMap((community) => community.members)) if (!users.has(member.userId)) users.set(member.userId, { id: member.userId, section, label: member.displayName, detail: `@${member.username}`, status: member.status, createdAt: now }); return [...users.values()]; }
  if (section === "communities") return mockCommunities.map((community) => ({ id: community.id, section, label: community.name, detail: `${community.members.length} visible members`, status: community.visibility ?? "private", createdAt: now }));
  if (section === "reports") return reportService.listReports().map((report) => ({ id: report.id, section, label: `${report.targetType} report`, detail: "Content withheld from operations list", status: report.status, createdAt: report.createdAt }));
  return abuseEventService.getRecentEvents(100).map((event) => ({ id: event.id, section, label: event.type.replace(/_/g, " "), detail: "Content-free safety signal", status: event.severity, createdAt: event.timestamp }));
}
function parseAdminPage(section: AdminOperationsListSection, value: unknown, limit: number): AdminOperationsPage | null { const row = asRecord(value); if (!row || !Array.isArray(row.items)) return null; const items = row.items.flatMap((value): AdminOperationsListItem[] => { const item = asRecord(value); if (!item || typeof item.id !== "string" || typeof item.label !== "string" || typeof item.created_at !== "string") return []; return [{ id: item.id, section, label: item.label, detail: typeof item.detail === "string" ? item.detail : "", status: typeof item.status === "string" ? item.status : "unknown", createdAt: item.created_at }]; }); return { items, nextCursor: encodeRemoteCursor(row.next_cursor), hasMore: row.has_more === true, limit }; }

function getLocalTrustSafetySummary(): TrustSafetySummary {
  const abuse = abuseEventService.getAdminSummary();
  const quarantine = attachmentQuarantineService.getAdminSummaryPlaceholder();
  return {
    openReports: reportService.getSummary().open,
    suspiciousUploads: Math.max(abuse.byType.suspicious_attachment ?? 0, quarantine.quarantinedCount),
    pendingUploadReviews: quarantine.needsReviewCount,
    abuseEvents: abuse.total,
    criticalAbuseEvents: abuse.critical,
    rateLimitEvents: abuse.byType.rate_limit_exceeded ?? 0,
    recentBans: null,
    recentKicks: null,
    windowHours: 0,
    checkedAt: new Date().toISOString(),
    source: "local_aggregate",
  };
}

export const adminOperationsService = {
  async getAccess(): Promise<AdminOperationsAccess> { if (import.meta.env.DEV) return { allowed: true, source: "development" }; const client = getSupabaseClient(); if (!client) return { allowed: false, source: "none" }; const { data, error } = await client.rpc("is_app_admin"); return !error && data ? { allowed: true, source: "app_admin" } : { allowed: false, source: "none" }; },
  getLocalTrustSafetySummary,
  async getSystemStatusV2(access: AdminOperationsAccess): Promise<AdminOperationsResult<AdminSystemStatusV2>> {
    if (!access.allowed || access.source === "none") return { ok: false, message: "App admin access is required." };
    if (access.source === "development" || dataSourceService.getStatus().isMock) return { ok: true, data: { database: "operational", users: new Set(mockCommunities.flatMap((community) => community.members.map((member) => member.userId))).size, communities: mockCommunities.length, openReports: reportService.getSummary().open, abuseEvents24h: abuseEventService.getAdminSummary().total, adminAuditEvents24h: 0, checkedAt: new Date().toISOString(), source: "local" } };
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Admin system status is unavailable." }; const { data, error } = await client.rpc("get_admin_system_status_v2"); const row = asRecord(data); if (error || !row) return { ok: false, message: "Picom could not load the restricted system status." };
    return { ok: true, data: { database: "operational", users: asCount(row.users), communities: asCount(row.communities), openReports: asCount(row.open_reports), abuseEvents24h: asCount(row.abuse_events_24h), adminAuditEvents24h: asCount(row.admin_audit_events_24h), checkedAt: typeof row.checked_at === "string" ? row.checked_at : new Date().toISOString(), source: "app_admin_rpc" } };
  },
  async listSection(section: AdminOperationsListSection, access: AdminOperationsAccess, cursor: string | null = null, limit = 25): Promise<AdminOperationsResult<AdminOperationsPage>> {
    if (!access.allowed || access.source === "none") return { ok: false, message: "App admin access is required." }; const safeLimit = Math.min(Math.max(Math.round(limit), 1), 50);
    if (access.source === "development" || dataSourceService.getStatus().isMock) { const offset = Math.max(0, Number.parseInt(cursor ?? "0", 10) || 0); const source = localAdminItems(section); const items = source.slice(offset, offset + safeLimit); const nextOffset = offset + items.length; return { ok: true, data: { items, nextCursor: nextOffset < source.length ? String(nextOffset) : null, hasMore: nextOffset < source.length, limit: safeLimit } }; }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Admin list is unavailable." }; const decoded = decodeRemoteCursor(cursor); const { data, error } = await client.rpc("list_admin_operations_v2", { section_name: section, page_cursor_created_at: decoded.createdAt, page_cursor_id: decoded.id, page_limit: safeLimit }); if (error) return { ok: false, message: "Picom could not load this restricted admin list." }; const page = parseAdminPage(section, data, safeLimit); return page ? { ok: true, data: page } : { ok: false, message: "Admin list returned an invalid response." };
  },
  async recordAction(access: AdminOperationsAccess, actionType: string, targetType = "system", targetId?: string): Promise<boolean> { if (!access.allowed || access.source === "none") return false; if (access.source === "development" || dataSourceService.getStatus().isMock) { loggingService.logInfo("Admin operations action", { actionType: actionType.slice(0, 80), targetType: targetType.slice(0, 40) }, "admin-audit"); return true; } const client = getSupabaseClient(); if (!client) return false; const { error } = await client.rpc("append_admin_operations_audit", { admin_action_type: actionType.slice(0, 80), admin_target_type: targetType.slice(0, 40), admin_target_id: targetId?.slice(0, 160) ?? null }); return !error; },
  async getTrustSafetySummary(access: AdminOperationsAccess): Promise<{ ok: true; data: TrustSafetySummary } | { ok: false; message: string }> {
    if (!access.allowed || (access.source !== "development" && access.source !== "app_admin")) return { ok: false, message: "App admin or development access is required." };
    if (access.source === "development" || dataSourceService.getStatus().isMock) return { ok: true, data: getLocalTrustSafetySummary() };
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Trust & Safety summary is unavailable." };
    const { data, error } = await client.rpc("get_trust_safety_summary");
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return { ok: false, message: "Picom could not load the restricted safety summary." };
    const row = data as Record<string, unknown>;
    return { ok: true, data: { openReports: asCount(row.openReports), suspiciousUploads: asCount(row.suspiciousUploads), pendingUploadReviews: asCount(row.pendingUploadReviews), abuseEvents: asCount(row.abuseEvents), criticalAbuseEvents: asCount(row.criticalAbuseEvents), rateLimitEvents: asCount(row.rateLimitEvents), recentBans: asCount(row.recentBans), recentKicks: asCount(row.recentKicks), windowHours: asCount(row.windowHours) || 24, checkedAt: typeof row.checkedAt === "string" ? row.checkedAt : new Date().toISOString(), source: "app_admin_rpc" } };
  },
  getSnapshot() {
    const users = new Set(mockCommunities.flatMap((community) => community.members.map((member) => member.userId)));
    const logs = loggingService.getRecentLogs(80);
    const network = networkStatusService.getSnapshot();
    const abuse = abuseEventService.getAdminSummary();
    const diagnostics = diagnosticsService.getSnapshot();
    const voiceQuality = voiceDiagnosticsRegistry.getSummary();
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
