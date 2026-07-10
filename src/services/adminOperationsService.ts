import { mockCommunities } from "../data/mockCommunities";
import { attachmentQuarantineService } from "./attachmentQuarantineService";
import { abuseEventService } from "./abuseEventService";
import { dataSourceService } from "./dataSourceService";
import { loggingService } from "./loggingService";
import { networkStatusService } from "./networkStatusService";
import { reportService } from "./reportService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type AdminOperationsAccess = Readonly<{ allowed: boolean; source: "development" | "app_admin" | "none" }>;
export const adminOperationsService = {
  async getAccess(): Promise<AdminOperationsAccess> { if (import.meta.env.DEV) return { allowed: true, source: "development" }; const client = getSupabaseClient(); if (!client) return { allowed: false, source: "none" }; const { data, error } = await client.rpc("is_app_admin"); return !error && data ? { allowed: true, source: "app_admin" } : { allowed: false, source: "none" }; },
  getSnapshot() { const users = new Set(mockCommunities.flatMap((community) => community.members.map((member) => member.userId))); const logs = loggingService.getRecentLogs(80); const network = networkStatusService.getSnapshot(); return { dataSource: dataSourceService.getStatus().mode, visibleUsers: users.size, visibleCommunities: mockCommunities.length, reports: reportService.getSummary(), abuse: abuseEventService.getAdminSummary(), quarantine: attachmentQuarantineService.getAdminSummaryPlaceholder(), storageStatus: "Supabase Storage health requires backend diagnostics", network, realtimeStatus: network.state === "online" ? "available" : network.state, recentErrors: logs.filter((entry) => entry.level === "error").slice(-12).reverse(), recentWarnings: logs.filter((entry) => entry.level === "warn").slice(-12).reverse() }; },
};
