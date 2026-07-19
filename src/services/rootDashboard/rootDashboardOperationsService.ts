import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import type { AdminOperationsResult } from "../../types/adminOperations";
import type { AdminOperationsAccess } from "../adminOperationsService";
import type {
  RootDashboardListPage,
  RootDashboardModuleSection,
  RootDashboardModuleSummaryKind,
  RootDashboardOverviewMetrics,
} from "../../types/rootDashboardOperations";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function encodeRemoteCursor(value: unknown): string | null {
  const row = asRecord(value);
  return row && typeof row.created_at === "string" && typeof row.id === "string"
    ? `${row.created_at}|${row.id}`
    : null;
}

function decodeRemoteCursor(value: string | null | undefined): { createdAt: string | null; id: string | null } {
  if (!value) return { createdAt: null, id: null };
  const separator = value.indexOf("|");
  return separator > 0
    ? { createdAt: value.slice(0, separator), id: value.slice(separator + 1) || null }
    : { createdAt: null, id: null };
}

function parseListPage(value: unknown, limit: number): RootDashboardListPage | null {
  const row = asRecord(value);
  if (!row || !Array.isArray(row.items)) return null;
  const items = row.items.flatMap((entry): RootDashboardListPage["items"][number][] => {
    const item = asRecord(entry);
    if (!item || typeof item.id !== "string" || typeof item.label !== "string" || typeof item.created_at !== "string") {
      return [];
    }
    return [{
      id: item.id,
      label: item.label,
      detail: typeof item.detail === "string" ? item.detail : "",
      status: typeof item.status === "string" ? item.status : "unknown",
      createdAt: item.created_at,
    }];
  });
  return {
    items,
    nextCursor: encodeRemoteCursor(row.next_cursor),
    hasMore: row.has_more === true,
    limit,
  };
}

function emptyOverview(): RootDashboardOverviewMetrics {
  return {
    onlineUsers: 0,
    activeSessions: 0,
    activeVoiceRooms: 0,
    registrations24h: 0,
    dau: null,
    wau: null,
    mau: null,
    analyticsAvailable: false,
    supportBacklog: 0,
    moderationBacklog: 0,
    securityAlerts24h: 0,
    adImpressions: 0,
    adClicks: 0,
    activeSubscriptions: 0,
    mrrCents: 0,
    openIncidents: 0,
    privilegedActions24h: 0,
    checkedAt: new Date().toISOString(),
    source: "local_empty",
  };
}

function parseOverview(value: unknown): RootDashboardOverviewMetrics | null {
  const row = asRecord(value);
  if (!row) return null;
  const analyticsAvailable = row.analytics_available === true;
  return {
    onlineUsers: asCount(row.online_users),
    activeSessions: asCount(row.active_sessions),
    activeVoiceRooms: asCount(row.active_voice_rooms),
    registrations24h: asCount(row.registrations_24h),
    dau: analyticsAvailable && row.dau !== null ? asCount(row.dau) : null,
    wau: analyticsAvailable && row.wau !== null ? asCount(row.wau) : null,
    mau: analyticsAvailable && row.mau !== null ? asCount(row.mau) : null,
    analyticsAvailable,
    supportBacklog: asCount(row.support_backlog),
    moderationBacklog: asCount(row.moderation_backlog),
    securityAlerts24h: asCount(row.security_alerts_24h),
    adImpressions: asCount(row.ad_impressions),
    adClicks: asCount(row.ad_clicks),
    activeSubscriptions: asCount(row.active_subscriptions),
    mrrCents: asCount(row.mrr_cents),
    openIncidents: asCount(row.open_incidents),
    privilegedActions24h: asCount(row.privileged_actions_24h),
    checkedAt: typeof row.checked_at === "string" ? row.checked_at : new Date().toISOString(),
    source: "app_admin_rpc",
  };
}

export const rootDashboardOperationsService = {
  async listModule(
    section: RootDashboardModuleSection,
    access: AdminOperationsAccess,
    cursor: string | null = null,
    limit = 25,
  ): Promise<AdminOperationsResult<RootDashboardListPage>> {
    if (!access.allowed || access.source === "none") {
      return { ok: false, message: "App admin access is required." };
    }

    const safeLimit = Math.min(Math.max(Math.round(limit), 1), 50);

    if (dataSourceService.getStatus().isMock) {
      return {
        ok: true,
        data: { items: [], nextCursor: null, hasMore: false, limit: safeLimit },
      };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Root dashboard list is unavailable." };

    const decoded = decodeRemoteCursor(cursor);
    const { data, error } = await client.rpc("list_root_dashboard_module_v1", {
      module_name: section,
      page_cursor_created_at: decoded.createdAt,
      page_cursor_id: decoded.id,
      page_limit: safeLimit,
    });

    if (error) return { ok: false, message: "Picom could not load this restricted dashboard list." };
    const page = parseListPage(data, safeLimit);
    return page ? { ok: true, data: page } : { ok: false, message: "Dashboard list returned an invalid response." };
  },

  async getOverviewMetrics(access: AdminOperationsAccess): Promise<AdminOperationsResult<RootDashboardOverviewMetrics>> {
    if (!access.allowed || access.source === "none") {
      return { ok: false, message: "App admin access is required." };
    }

    if (dataSourceService.getStatus().isMock) {
      return { ok: true, data: emptyOverview() };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Root dashboard overview is unavailable." };

    const { data, error } = await client.rpc("get_root_dashboard_overview_v1");
    if (error) return { ok: false, message: "Picom could not load the restricted overview aggregates." };

    const parsed = parseOverview(data);
    return parsed ? { ok: true, data: parsed } : { ok: false, message: "Overview returned an invalid response." };
  },

  async getModuleSummary(
    module: RootDashboardModuleSummaryKind,
    access: AdminOperationsAccess,
  ): Promise<AdminOperationsResult<Record<string, number>>> {
    if (!access.allowed || access.source === "none") {
      return { ok: false, message: "App admin access is required." };
    }

    if (dataSourceService.getStatus().isMock) {
      return { ok: true, data: {} };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Module summary is unavailable." };

    const { data, error } = await client.rpc("get_root_dashboard_module_summary_v1", { module_name: module });
    if (error) return { ok: false, message: "Picom could not load the module summary." };

    const row = asRecord(data);
    if (!row) return { ok: false, message: "Module summary returned an invalid response." };

    const summary: Record<string, number> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "number" && Number.isFinite(value)) summary[key] = Math.floor(value);
    }
    return { ok: true, data: summary };
  },
};
