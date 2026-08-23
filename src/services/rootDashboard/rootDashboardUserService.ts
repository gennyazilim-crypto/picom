import { getSupabaseClient } from "../../lib/supabaseClient";
import type {
  RootUserActionRequest,
  RootUserActionResult,
  RootUserCapabilities,
  RootUserDetail,
  RootUserFilters,
  RootUserListItem,
  RootUserListResponse,
  RootUserSummary,
} from "../../types/rootDashboardUsers";

type RpcResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

type InvokeResult = {
  data: unknown;
  error: { message: string; context?: unknown } | null;
};

export type RootUserRealtimeSubscription = {
  unsubscribe: () => void;
};

const recordOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const arrayOfRecords = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.map(recordOf) : [];

const stringOf = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const numberOf = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const booleanOf = (value: unknown): boolean => value === true;

const nullableStringOf = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const parseUser = (value: unknown): RootUserListItem => {
  const row = recordOf(value);
  return {
    id: stringOf(row.id),
    displayName: stringOf(row.display_name ?? row.displayName, "Unnamed user"),
    username: stringOf(row.username, "unknown"),
    avatarUrl: nullableStringOf(row.avatar_url ?? row.avatarUrl),
    email: stringOf(row.email, "Hidden"),
    emailStatus: stringOf(row.email_status ?? row.emailStatus, "unverified") as RootUserListItem["emailStatus"],
    accountStatus: stringOf(row.account_status ?? row.accountStatus, "active") as RootUserListItem["accountStatus"],
    role: stringOf(row.role, "member"),
    risk: stringOf(row.risk, "none") as RootUserListItem["risk"],
    mfaEnabled: booleanOf(row.mfa_enabled ?? row.mfaEnabled),
    createdAt: stringOf(row.created_at ?? row.createdAt, new Date(0).toISOString()),
    lastSeenAt: nullableStringOf(row.last_seen_at ?? row.lastSeenAt),
    platform: stringOf(row.platform, "Unknown"),
  };
};

const parseSummary = (value: unknown): RootUserSummary => {
  const row = recordOf(value);
  return {
    total: numberOf(row.total),
    active: numberOf(row.active),
    unverified: numberOf(row.unverified),
    suspended: numberOf(row.suspended),
    temporarilyBanned: numberOf(row.temporarily_banned ?? row.temporarilyBanned),
    permanentlyBanned: numberOf(row.permanently_banned ?? row.permanentlyBanned),
    registered24h: numberOf(row.registered_24h ?? row.registered24h),
    active7d: numberOf(row.active_7d ?? row.active7d),
    deletionPending: numberOf(row.deletion_pending ?? row.deletionPending),
  };
};

const parseCapabilities = (value: unknown): RootUserCapabilities => {
  const row = recordOf(value);
  return {
    canViewFullEmail: booleanOf(row.can_view_full_email ?? row.canViewFullEmail),
    canWrite: booleanOf(row.can_write ?? row.canWrite),
    canManageRoles: booleanOf(row.can_manage_roles ?? row.canManageRoles),
    canExport: booleanOf(row.can_export ?? row.canExport),
    canPermanentlyDelete: booleanOf(row.can_permanently_delete ?? row.canPermanentlyDelete),
  };
};

const requireClient = () => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured for Root Dashboard.");
  return client;
};

const rpc = async (functionName: string, args: Record<string, unknown>): Promise<unknown> => {
  const client = requireClient();
  const invokeRpc = client.rpc.bind(client) as unknown as (
    name: string,
    parameters: Record<string, unknown>,
  ) => Promise<RpcResult>;
  const { data, error } = await invokeRpc(functionName, args);
  if (error) throw new Error(error.message);
  return data;
};

export const rootDashboardUserService = {
  async listUsers(filters: RootUserFilters): Promise<RootUserListResponse> {
    const payload = recordOf(await rpc("list_root_users_v2", {
      p_search: filters.search.trim() || null,
      p_status: filters.status === "all" ? null : filters.status,
      p_email_status: filters.emailStatus === "all" ? null : filters.emailStatus,
      p_role: filters.role === "all" ? null : filters.role,
      p_risk: filters.risk === "all" ? null : filters.risk,
      p_platform: filters.platform === "all" ? null : filters.platform,
      p_created_from: filters.createdFrom || null,
      p_created_to: filters.createdTo || null,
      p_last_seen: filters.lastSeen === "all" ? null : filters.lastSeen,
      p_sort: filters.sort,
      p_direction: filters.direction,
      p_page: filters.page,
      p_page_size: filters.pageSize,
      p_include_deleted: filters.includeDeleted,
    }));

    return {
      items: Array.isArray(payload.items) ? payload.items.map(parseUser) : [],
      total: numberOf(payload.total),
      summary: parseSummary(payload.summary),
      capabilities: parseCapabilities(payload.capabilities),
      checkedAt: stringOf(payload.checked_at ?? payload.checkedAt, new Date().toISOString()),
    };
  },

  async getUserDetail(userId: string): Promise<RootUserDetail> {
    const payload = recordOf(await rpc("get_root_user_details_v2", { p_target_user_id: userId }));
    const auth = recordOf(payload.auth);
    const account = recordOf(payload.account);
    const security = recordOf(payload.security);
    const content = recordOf(payload.content);
    const dmSafety = recordOf(payload.dm_safety ?? payload.dmSafety);
    const notifications = recordOf(payload.notifications);
    return {
      user: parseUser(payload.user),
      auth: {
        provider: stringOf(auth.provider, "email"),
        emailConfirmedAt: nullableStringOf(auth.email_confirmed_at ?? auth.emailConfirmedAt),
        lastSignInAt: nullableStringOf(auth.last_sign_in_at ?? auth.lastSignInAt),
      },
      account: {
        updatedAt: nullableStringOf(account.updated_at ?? account.updatedAt),
        onboardingCompleted: booleanOf(account.onboarding_completed ?? account.onboardingCompleted),
        deletionRequestedAt: nullableStringOf(account.deletion_requested_at ?? account.deletionRequestedAt),
      },
      security: {
        mfaFactorCount: numberOf(security.mfa_factor_count ?? security.mfaFactorCount),
        activeSessionCount: numberOf(security.active_session_count ?? security.activeSessionCount),
        riskLevel: stringOf(security.risk_level ?? security.riskLevel, "none") as RootUserDetail["security"]["riskLevel"],
      },
      sessions: arrayOfRecords(payload.sessions),
      roles: arrayOfRecords(payload.roles),
      securityFlags: arrayOfRecords(payload.security_flags ?? payload.securityFlags),
      restrictions: arrayOfRecords(payload.restrictions),
      bans: arrayOfRecords(payload.bans),
      tags: arrayOfRecords(payload.tags),
      communities: arrayOfRecords(payload.communities),
      content: Object.fromEntries(Object.entries(content).map(([key, value]) => [key, numberOf(value)])),
      dmSafety,
      emails: arrayOfRecords(payload.emails),
      notifications,
      audit: arrayOfRecords(payload.audit),
    };
  },

  async performAction(request: RootUserActionRequest): Promise<RootUserActionResult> {
    const client = requireClient();
    const invoke = client.functions.invoke.bind(client.functions) as unknown as (
      name: string,
      options: { body: RootUserActionRequest },
    ) => Promise<InvokeResult>;
    const { data, error } = await invoke("admin-user-actions", { body: request });
    if (error) throw new Error(error.message);
    const payload = recordOf(data);
    return {
      success: booleanOf(payload.success),
      message: stringOf(payload.message, booleanOf(payload.success) ? "Action completed." : "Action failed."),
      requestId: nullableStringOf(payload.requestId ?? payload.request_id) ?? undefined,
      download: payload.download ? {
        fileName: stringOf(recordOf(payload.download).fileName ?? recordOf(payload.download).file_name, "picom-users.csv"),
        mimeType: stringOf(recordOf(payload.download).mimeType ?? recordOf(payload.download).mime_type, "text/csv"),
        content: stringOf(recordOf(payload.download).content),
      } : undefined,
    };
  },

  subscribe(onInvalidate: () => void): RootUserRealtimeSubscription {
    const client = getSupabaseClient();
    if (!client) return { unsubscribe: () => undefined };
    const channelName = `root-users:${crypto.randomUUID()}`;
    const channel = client
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_account_restrictions" },
        onInvalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_restrictions" },
        onInvalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_bans" },
        onInvalidate,
      )
      .subscribe();

    return {
      unsubscribe: () => {
        void client.removeChannel(channel);
      },
    };
  },

  downloadExport(download: { fileName: string; mimeType: string; content: string }): void {
    const blob = new Blob([download.content], { type: download.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = download.fileName;
    anchor.rel = "noopener";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  },
};
